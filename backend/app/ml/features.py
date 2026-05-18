"""
Feature extraction for the ML model.
Each function returns a single normalised float in [0, 1].
"""
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.nutrition import NutritionLog


def get_nutrition_consistency(user_id: UUID, db: Session) -> float:
    """
    Fraction of the last 14 days on which the user logged at least one meal.
    Returns a value in [0.0, 1.0].
    """
    cutoff = date.today() - timedelta(days=14)
    distinct_days: int = (
        db.query(func.count(func.distinct(NutritionLog.date)))
        .filter(
            NutritionLog.user_id == user_id,
            NutritionLog.date >= cutoff,
        )
        .scalar()
    ) or 0
    return round(min(distinct_days, 14) / 14, 4)
