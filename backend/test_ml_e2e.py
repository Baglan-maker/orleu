"""
End-to-end smoke test for the ML pipeline.
Run from backend/: python test_ml_e2e.py
"""
import sys
import traceback
from datetime import datetime, timedelta, timezone
from uuid import UUID

issues: list[str] = []


def check(label, fn):
    print(f"  - {label}")
    try:
        fn()
        print(f"    PASS")
    except Exception as e:
        msg = f"FAIL [{label}]: {type(e).__name__}: {e}"
        print(f"    {msg}")
        traceback.print_exc()
        issues.append(msg)


# ── 1. Model file & predict_trend on synthetic features ──────────────────────
print("\n[1] Model load + predict_trend smoke")

def t1():
    from ml.predict import predict_trend, _load
    bundle = _load()
    assert "model" in bundle and "feature_cols" in bundle and "label_map" in bundle
    assert bundle["label_map"] == {0: "improving", 1: "plateau", 2: "declining"}
    assert len(bundle["feature_cols"]) == 5

check("model bundle structure", t1)


def t2():
    # Mock build_features for archetype tests, then RESTORE so later tests
    # (run_nightly_predictions) use the real implementation against the real DB.
    from ml import predict as pred_mod
    original = pred_mod.build_features
    try:
        pred_mod.build_features = lambda uid, db: {
            "weekly_volume_delta":   0.20,
            "session_frequency":     0.70,
            "load_progression":      1.15,
            "consistency_score":     0.75,
            "nutrition_consistency": 0.60,
        }
        from uuid import uuid4
        result = pred_mod.predict_trend(uuid4(), None)
        assert result["trend"] == "improving", f"expected improving, got {result['trend']}"
        assert result["confidence"] > 0.5
        assert "shap_values" in result and len(result["shap_values"]) == 5
        assert "features" in result

        pred_mod.build_features = lambda uid, db: {
            "weekly_volume_delta":   -0.30,
            "session_frequency":     0.15,
            "load_progression":      0.85,
            "consistency_score":     0.10,
            "nutrition_consistency": 0.05,
        }
        result = pred_mod.predict_trend(uuid4(), None)
        assert result["trend"] == "declining", f"expected declining, got {result['trend']}"
    finally:
        pred_mod.build_features = original

check("predict_trend on archetype inputs", t2)


# ── 2. SHAP value structure (the bug-prone part) ──────────────────────────────
print("\n[2] SHAP integration")

def t3():
    import numpy as np
    import shap
    from ml.predict import _load

    bundle = _load()
    model = bundle["model"]
    feature_cols = bundle["feature_cols"]

    X = np.array([[0.20, 0.70, 1.15, 0.75, 0.60]], dtype=np.float64)
    explainer = shap.TreeExplainer(model)
    raw = explainer.shap_values(X)

    # Check what format SHAP returns — must match predict.py logic
    if isinstance(raw, list):
        shape_info = f"list of {len(raw)} arrays, each {raw[0].shape}"
        n_classes_in_shap = len(raw)
    else:
        shape_info = f"ndarray {raw.shape}"
        n_classes_in_shap = raw.shape[2] if raw.ndim == 3 else None

    print(f"    SHAP raw format: {shape_info}")
    assert n_classes_in_shap == 3, f"expected 3 classes in SHAP output, got {n_classes_in_shap}"

check("SHAP output structure", t3)


# ── 3. Real DB queries — features.py ──────────────────────────────────────────
print("\n[3] features.py against real DB")

def t4():
    from app.db.database import SessionLocal
    from app.models.auth import User
    from ml.features import build_features

    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("    SKIP — no users in DB")
            return
        feats = build_features(user.id, db)
        print(f"    user={user.email}  features={feats}")
        assert set(feats.keys()) == {
            "weekly_volume_delta", "session_frequency", "load_progression",
            "consistency_score", "nutrition_consistency",
        }
        for k, v in feats.items():
            assert isinstance(v, float), f"{k} is not float, got {type(v).__name__}"
            assert v == v, f"{k} is NaN"  # NaN check
    finally:
        db.close()

check("build_features() runs against real DB", t4)


# ── 4. Nightly job ─────────────────────────────────────────────────────────────
print("\n[4] Nightly ML job")

def t5():
    from app.tasks.nightly_ml import run_nightly_predictions
    n = run_nightly_predictions()
    print(f"    processed_users={n}")

check("run_nightly_predictions() executes without errors", t5)


def t6():
    # Idempotency — second call must not crash
    from app.tasks.nightly_ml import run_nightly_predictions
    n1 = run_nightly_predictions()
    n2 = run_nightly_predictions()
    print(f"    first={n1}  second={n2}")
    # Both should equal — same eligible users processed
    assert n1 == n2, f"non-idempotent: {n1} vs {n2}"

check("idempotency of run_nightly_predictions()", t6)


# ── 5. Coach service — message dedup ─────────────────────────────────────────
print("\n[5] Coach message generation")

def t7():
    from app.db.database import SessionLocal
    from app.models.ml import MlPrediction, CoachMessage
    from app.services.coach_service import generate_message

    db = SessionLocal()
    try:
        pred = db.query(MlPrediction).first()
        if not pred:
            print("    SKIP — no predictions in DB (run nightly first)")
            return

        # Count messages for this prediction
        before = db.query(CoachMessage).filter(CoachMessage.prediction_id == pred.id).count()

        msg1 = generate_message(pred.user_id, pred, db)
        db.commit()

        after_first = db.query(CoachMessage).filter(CoachMessage.prediction_id == pred.id).count()

        msg2 = generate_message(pred.user_id, pred, db)
        db.commit()

        after_second = db.query(CoachMessage).filter(CoachMessage.prediction_id == pred.id).count()

        print(f"    msgs_before={before}  after_1st_call={after_first}  after_2nd_call={after_second}")
        assert after_first == after_second, "duplicate messages on second call — not idempotent"
    finally:
        db.close()

check("generate_message idempotent on prediction_id", t7)


# ── 6. API contracts — verify response shapes ─────────────────────────────────
print("\n[6] API endpoint contracts (in-process)")

def t8():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200, r.text
    print(f"    /health -> {r.json()}")

check("health endpoint", t8)


def t9():
    # Inspect the OpenAPI schema for our new endpoints — quick sanity on the contract
    from app.main import app
    paths = app.openapi()["paths"]

    expected = [
        "/api/progress/ml-status",
        "/api/coach",
        "/api/coach/{message_id}/read",
        "/api/debug/run-ml",
    ]
    for p in expected:
        assert p in paths, f"missing path: {p}"
        print(f"    found {p}")

    # Check missions response includes 'trend' field
    missions_get = paths["/api/missions"]["get"]
    response_schema = missions_get["responses"]["200"]["content"]["application/json"]["schema"]
    ref = response_schema.get("$ref", "")
    if ref:
        # Resolve $ref
        schema_name = ref.split("/")[-1]
        components = app.openapi()["components"]["schemas"]
        avail_schema = components[schema_name]
        assert "trend" in avail_schema["properties"], "AvailableMissionsOut missing 'trend' field"
        print(f"    AvailableMissionsOut has 'trend' field: OK")

check("ML/coach endpoints registered + missions trend field present", t9)


# ── 7. ML status endpoint shape ───────────────────────────────────────────────
print("\n[7] ML status response (cold-start path)")

def t10():
    from app.main import app
    schema = app.openapi()["components"]["schemas"]
    ml_out = schema.get("MlStatusOut")
    assert ml_out, "MlStatusOut schema missing"
    required_props = {
        "available", "trend", "confidence", "prediction_date",
        "top_feature", "features", "shap_values", "cold_start_reason",
    }
    actual = set(ml_out["properties"].keys())
    missing = required_props - actual
    assert not missing, f"MlStatusOut missing properties: {missing}"
    print(f"    MlStatusOut has all expected fields: {sorted(actual)}")

check("MlStatusOut schema", t10)


# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
if issues:
    print(f"ISSUES FOUND: {len(issues)}")
    for i in issues:
        print(f"  - {i}")
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
