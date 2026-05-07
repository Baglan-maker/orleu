"""
Nightly ML prediction job.

run_nightly_predictions() is called by APScheduler every day at 00:00 UTC.
Eligibility: created_at older than 14 days AND at least 3 workouts logged.

For each eligible user:
  1. Run predict_trend() and upsert into ml_predictions
  2. Generate a CoachMessage tied to the prediction (idempotent on prediction_id)
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.auth import User
from app.models.ml import MlPrediction
from app.models.workout import Workout
from app.services.coach_service import generate_message
from ml.predict import predict_trend

MODEL_VERSION = "1.0.0"


def run_nightly_predictions() -> int:
    """
    Iterates all eligible users, calls predict_trend(), upserts into ml_predictions,
    and generates a CoachMessage for each.
    Returns the number of users successfully processed.
    """
    db: Session = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)
        today  = date.today()

        eligible: list[User] = (
            db.query(User)
            .filter(User.created_at < cutoff)
            .all()
        )

        processed = 0

        for user in eligible:
            workout_count: int = (
                db.query(func.count(Workout.id))
                .filter(Workout.user_id == user.id)
                .scalar()
            ) or 0

            if workout_count < 3:
                continue

            try:
                result = predict_trend(user.id, db)
            except Exception:
                # Insufficient feature data for this user — skip silently
                continue

            # Upsert: one row per user per day (unique constraint on user_id + prediction_date)
            existing = (
                db.query(MlPrediction)
                .filter(
                    MlPrediction.user_id         == user.id,
                    MlPrediction.prediction_date == today,
                )
                .first()
            )

            if existing:
                existing.trend         = result["trend"]
                existing.confidence    = result["confidence"]
                existing.features_json = result["features"]
                existing.shap_values   = result["shap_values"]
                existing.model_version = MODEL_VERSION
                prediction = existing
            else:
                prediction = MlPrediction(
                    user_id         = user.id,
                    prediction_date = today,
                    trend           = result["trend"],
                    confidence      = result["confidence"],
                    features_json   = result["features"],
                    shap_values     = result["shap_values"],
                    model_version   = MODEL_VERSION,
                )
                db.add(prediction)

            db.flush()  # ensures prediction.id is set before generate_message

            generate_message(user.id, prediction, db)

            db.commit()
            processed += 1

        return processed

    finally:
        db.close()
