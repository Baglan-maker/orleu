from datetime import date
from typing import Optional

from pydantic import BaseModel


class MlStatusOut(BaseModel):
    """
    Latest ML trend prediction for the current user.
    `available=False` for users in cold-start (< 14 days registered or < 3 workouts).
    """
    available:         bool
    trend:             Optional[str]              = None  # improving | plateau | declining
    confidence:        Optional[float]            = None
    prediction_date:   Optional[date]             = None
    top_feature:       Optional[str]              = None  # name of the strongest SHAP driver
    features:          Optional[dict[str, float]] = None  # 5 raw feature values
    shap_values:       Optional[dict[str, float]] = None  # full SHAP dict (for thesis charts)
    cold_start_reason: Optional[str]              = None  # human-readable explanation if unavailable
