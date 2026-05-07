"""
predict_trend(user_id, db) → dict with trend, confidence, and SHAP values.

Model is lazy-loaded on first call and cached in memory for the process lifetime.
Run ml/train.py once to generate model.pkl before using this module.
"""
import os
from uuid import UUID

import joblib
import numpy as np
import shap
from sqlalchemy.orm import Session

from ml.features import build_features

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

_bundle: dict | None = None


def _load() -> dict:
    global _bundle
    if _bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. Run: python -m ml.train"
            )
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def predict_trend(user_id: UUID, db: Session) -> dict:
    """
    Returns:
        {
            "user_id":     str,
            "trend":       "improving" | "plateau" | "declining",
            "confidence":  float,          # probability of predicted class
            "shap_values": {feature: float, ...},
            "features":    {feature: float, ...},
        }
    """
    bundle       = _load()
    model        = bundle["model"]
    feature_cols = bundle["feature_cols"]
    label_map    = bundle["label_map"]

    features = build_features(user_id, db)
    X = np.array([[features[col] for col in feature_cols]], dtype=np.float64)

    proba      = model.predict_proba(X)[0]       # shape (3,)
    pred_class = int(np.argmax(proba))
    trend      = label_map[pred_class]
    confidence = round(float(proba[pred_class]), 4)

    # SHAP explainability — required for diploma
    explainer = shap.TreeExplainer(model)
    raw       = explainer.shap_values(X)

    # SHAP for multiclass: list[n_classes] of (n_samples, n_features)
    # or ndarray (n_samples, n_features, n_classes) in newer SHAP versions
    if isinstance(raw, list):
        shap_for_class = raw[pred_class][0]
    else:
        shap_for_class = raw[0, :, pred_class]

    shap_dict = {
        col: round(float(val), 5)
        for col, val in zip(feature_cols, shap_for_class)
    }

    return {
        "user_id":    str(user_id),
        "trend":      trend,
        "confidence": confidence,
        "shap_values": shap_dict,
        "features":   features,
    }
