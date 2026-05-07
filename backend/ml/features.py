"""
Feature extraction for the Orleu ML pipeline.
build_features(user_id, db) → dict of 5 floats used by predict_trend().
"""
from uuid import UUID
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.workout import Workout, WorkoutExercise
from app.models.nutrition import NutritionLog


def build_features(user_id: UUID, db: Session) -> dict:
    today         = date.today()
    week_ago      = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)

    # ── 1. weekly_volume_delta ─────────────────────────────────────────────────
    # (current_week_volume - prev_week_volume) / prev_week_volume
    # volume = SUM(sets × reps × weight_kg) for all exercises in the period

    def _volume(from_date: date, to_date: date) -> float:
        rows = (
            db.query(WorkoutExercise.sets, WorkoutExercise.reps, WorkoutExercise.weight_kg)
            .join(Workout, Workout.id == WorkoutExercise.workout_id)
            .filter(
                Workout.user_id      == user_id,
                Workout.workout_date >= from_date,
                Workout.workout_date <  to_date,
            )
            .all()
        )
        return sum(r.sets * r.reps * (r.weight_kg or 0.0) for r in rows)

    vol_current = _volume(week_ago, today)
    vol_prev    = _volume(two_weeks_ago, week_ago)

    if vol_prev == 0:
        weekly_volume_delta = 0.0
    else:
        weekly_volume_delta = (vol_current - vol_prev) / vol_prev

    # ── 2. session_frequency ──────────────────────────────────────────────────
    # number of workouts in last 7 days / 7

    sessions_last7: int = (
        db.query(func.count(Workout.id))
        .filter(
            Workout.user_id      == user_id,
            Workout.workout_date >= week_ago,
        )
        .scalar()
    ) or 0
    session_frequency = sessions_last7 / 7.0

    # ── 3. load_progression ────────────────────────────────────────────────────
    # avg weight this week / avg weight prev week
    # Only non-zero weights counted (bodyweight exercises excluded)

    def _avg_weight(from_date: date, to_date: date):
        result = (
            db.query(func.avg(WorkoutExercise.weight_kg))
            .join(Workout, Workout.id == WorkoutExercise.workout_id)
            .filter(
                Workout.user_id          == user_id,
                Workout.workout_date     >= from_date,
                Workout.workout_date     <  to_date,
                WorkoutExercise.weight_kg > 0,
            )
            .scalar()
        )
        return float(result) if result else None

    avg_w_current = _avg_weight(week_ago, today)
    avg_w_prev    = _avg_weight(two_weeks_ago, week_ago)

    if avg_w_prev is None or avg_w_current is None or avg_w_prev == 0:
        load_progression = 1.0
    else:
        load_progression = avg_w_current / avg_w_prev

    # ── 4. consistency_score ────────────────────────────────────────────────────
    # distinct workout days in last 14 days / 14

    distinct_workout_days: int = (
        db.query(func.count(func.distinct(Workout.workout_date)))
        .filter(
            Workout.user_id      == user_id,
            Workout.workout_date >= two_weeks_ago,
        )
        .scalar()
    ) or 0
    consistency_score = min(distinct_workout_days, 14) / 14.0

    # ── 5. nutrition_consistency ────────────────────────────────────────────────
    # distinct days with a nutrition log entry in last 14 days / 14
    # If the user has never logged nutrition at all → 0.5 (neutral, no signal)

    total_nutrition_logs: int = (
        db.query(func.count(NutritionLog.id))
        .filter(NutritionLog.user_id == user_id)
        .scalar()
    ) or 0

    if total_nutrition_logs == 0:
        nutrition_consistency = 0.5
    else:
        distinct_nutrition_days: int = (
            db.query(func.count(func.distinct(NutritionLog.date)))
            .filter(
                NutritionLog.user_id == user_id,
                NutritionLog.date    >= two_weeks_ago,
            )
            .scalar()
        ) or 0
        nutrition_consistency = min(distinct_nutrition_days, 14) / 14.0

    return {
        "weekly_volume_delta":   round(weekly_volume_delta,   4),
        "session_frequency":     round(session_frequency,     4),
        "load_progression":      round(load_progression,      4),
        "consistency_score":     round(consistency_score,     4),
        "nutrition_consistency": round(nutrition_consistency, 4),
    }
