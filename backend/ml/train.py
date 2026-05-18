"""
Train LightGBM trend classifier on synthetic data.

Run from backend/ directory:
    python -m ml.train

Saves model to backend/ml/model.pkl.

Data strategy: generate N samples PER CLASS with overlapping realistic ranges,
then add gaussian noise. Classes must overlap at boundaries so the model
learns generalised patterns, not memorised thresholds.
Target accuracy: 80-90% (healthy for noisy real-world data).
"""
import os

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

FEATURE_COLS = [
    "weekly_volume_delta",
    "session_frequency",
    "load_progression",
    "consistency_score",
    "nutrition_consistency",
]

# 0=improving, 1=plateau, 2=declining  (matches theme.ts: up/flat/dn)
LABEL_MAP = {0: "improving", 1: "plateau", 2: "declining"}

MODEL_PATH   = os.path.join(os.path.dirname(__file__), "model.pkl")
RANDOM_STATE = 42

# ── Per-class feature archetypes ──────────────────────────────────────────────
#
# Ranges intentionally OVERLAP at boundaries (improving/plateau share
# vol_delta 0.03-0.12, plateau/declining share consistency 0.25-0.45, etc.)
# so the model must learn joint patterns across all 5 features — not just
# one threshold rule. This forces generalisation and realistic accuracy.
#
_ARCHETYPES = {
    0: {  # improving
        "weekly_volume_delta":   ( 0.03,  0.50),   # mostly positive
        "session_frequency":     ( 0.43,  1.00),   # training often
        "load_progression":      ( 0.95,  1.50),   # weights going up
        "consistency_score":     ( 0.43,  1.00),   # regular schedule
        "nutrition_consistency": ( 0.25,  1.00),
    },
    1: {  # plateau
        "weekly_volume_delta":   (-0.12,  0.15),   # overlaps improving & declining
        "session_frequency":     ( 0.25,  0.72),
        "load_progression":      ( 0.85,  1.15),
        "consistency_score":     ( 0.25,  0.68),   # overlaps both sides
        "nutrition_consistency": ( 0.15,  0.72),
    },
    2: {  # declining
        "weekly_volume_delta":   (-0.50,  0.05),   # overlaps plateau at top
        "session_frequency":     ( 0.00,  0.50),
        "load_progression":      ( 0.70,  1.05),
        "consistency_score":     ( 0.00,  0.45),   # overlaps plateau at top
        "nutrition_consistency": ( 0.00,  0.45),
    },
}

# Gaussian noise — wide enough to push samples across class boundaries,
# creating the ambiguous examples that prevent memorisation.
_NOISE_STD = {
    "weekly_volume_delta":   0.10,
    "session_frequency":     0.10,
    "load_progression":      0.10,
    "consistency_score":     0.10,
    "nutrition_consistency": 0.08,
}

_CLIPS = {
    "weekly_volume_delta":   (-1.0,  1.0),
    "session_frequency":     ( 0.0,  1.0),
    "load_progression":      ( 0.5,  2.0),
    "consistency_score":     ( 0.0,  1.0),
    "nutrition_consistency": ( 0.0,  1.0),
}


def generate(n_per_class: int = 67, seed: int = RANDOM_STATE) -> pd.DataFrame:
    """Balanced: exactly n_per_class rows per label. Total = n_per_class * 3."""
    rng = np.random.default_rng(seed)
    frames = []

    for label, ranges in _ARCHETYPES.items():
        rows: dict[str, np.ndarray] = {}
        for feat, (lo, hi) in ranges.items():
            base  = rng.uniform(lo, hi, n_per_class)
            noise = rng.normal(0.0, _NOISE_STD[feat], n_per_class)
            lo_c, hi_c = _CLIPS[feat]
            rows[feat] = np.clip(base + noise, lo_c, hi_c).round(4)

        df_class = pd.DataFrame(rows)
        df_class["label"] = label
        frames.append(df_class)

    return pd.concat(frames, ignore_index=True)


def train() -> None:
    n_per_class = 200   # 600 total — enough for stable test-set variance
    print(f"Generating synthetic training data ({n_per_class} rows x 3 classes)...")
    df = generate(n_per_class=n_per_class)

    print("Label distribution:")
    for k in range(3):
        cnt = (df["label"] == k).sum()
        pct = cnt / len(df) * 100
        print(f"  {LABEL_MAP[k]:>10}: {cnt}  ({pct:.1f}%)")
    print()

    X = df[FEATURE_COLS].values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y,
    )
    print(f"Train: {len(X_train)}  Test: {len(X_test)}\n")

    model = lgb.LGBMClassifier(
        n_estimators=100,
        max_depth=4,
        min_child_samples=5,
        lambda_l1=0.1,
        lambda_l2=0.1,
        feature_fraction=0.8,
        random_state=RANDOM_STATE,
        verbose=-1,
    )

    # CV on training split
    # Wrap in DataFrame so LightGBM keeps feature names and sklearn doesn't warn
    df_train = pd.DataFrame(X_train, columns=FEATURE_COLS)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    cv_scores = cross_val_score(model, df_train, y_train, cv=cv, scoring="accuracy")
    print(f"CV accuracy:   {cv_scores.mean():.3f} +/- {cv_scores.std():.3f}")

    # Fit with feature names so predict keeps them consistent
    model.fit(
        pd.DataFrame(X_train, columns=FEATURE_COLS),
        y_train,
    )

    y_pred = model.predict(pd.DataFrame(X_test, columns=FEATURE_COLS))
    test_acc = accuracy_score(y_test, y_pred)
    print(f"Test accuracy: {test_acc:.3f}")

    # gap > 0 means model does better on test than CV (possible lucky split or overfit)
    gap = test_acc - cv_scores.mean()
    if gap > 0.12:
        print(f"WARNING: test accuracy much higher than CV ({gap:+.3f}) — possible lucky split or overfitting")
    if test_acc < 0.75:
        print("WARNING: accuracy below 75% — noise may be too high")
    if test_acc > 0.97:
        print("WARNING: accuracy above 97% — classes may not overlap enough (overfitting risk)")

    print(f"\n{classification_report(y_test, y_pred, target_names=[LABEL_MAP[i] for i in range(3)])}")

    print("Feature importances:")
    for feat, imp in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1]):
        print(f"  {feat:<28} {imp}")

    joblib.dump(
        {
            "model":        model,
            "feature_cols": FEATURE_COLS,
            "label_map":    LABEL_MAP,
        },
        MODEL_PATH,
    )
    print(f"\nModel saved -> {MODEL_PATH}")


if __name__ == "__main__":
    train()
