"""
Debug endpoints for faster testing of streaks, campaigns, achievements, etc.
Only available when APP_ENV == "development".
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta, date
import random

from app.db.database import get_db
from app.config import settings
from app.models import (
    User, Workout, ExerciseLibrary, UserProgress,
    UserMission, UserAchievement, CampaignChapter, Campaign,
)
from app.models.workout import WorkoutExercise
from app.models.ml import MlPrediction, CoachMessage
from app.services.coach_service import generate_message
from app.services.dependencies import get_current_user
from app.services.gamification_service import check_and_award_achievements, try_advance_chapter
from app.tasks.nightly_ml import run_nightly_predictions
# Single source of truth for leveling + XP so debug seeding matches real workouts.
from app.api.workouts import (
    _recalculate_level, _XP_THRESHOLDS, MAX_LEVEL,
    BASE_XP_PER_WORKOUT, XP_PER_EXERCISE, XP_PER_1000KG_VOL,
)


def _xp_floor_for_level(level: int) -> int:
    """Minimum cumulative XP to be at the given level (1-indexed)."""
    lvl = max(1, min(level, MAX_LEVEL))
    return sum(_XP_THRESHOLDS[: lvl - 1])

router = APIRouter()


def _require_dev():
    if settings.APP_ENV != "development":
        raise HTTPException(status_code=403, detail="Debug endpoints are disabled in production")


# ── Schemas ──────────────────────────────────────────────────────────────────

class TimeTravelRequest(BaseModel):
    set_streak: Optional[int] = Field(None, ge=0, description="Set current_streak to this value")
    set_total_workouts: Optional[int] = Field(None, ge=0, description="Set total_workouts counter")
    set_missions_completed: Optional[int] = Field(None, ge=0, description="Set missions_completed_count")
    set_level: Optional[int] = Field(None, ge=1, description="Set level directly")
    set_xp: Optional[int] = Field(None, ge=0, description="Set XP directly")
    set_coins: Optional[int] = Field(None, ge=0, description="Set coins directly")
    set_campaign_path: Optional[str] = Field(None, pattern="^[AB]$", description="Set campaign_path to A or B")
    set_campaign_workouts: Optional[int] = Field(None, ge=0, description="Set workouts relative to campaign start (adjusts baseline)")
    set_campaign_missions: Optional[int] = Field(None, ge=0, description="Set missions relative to campaign start (adjusts baseline)")
    set_campaign_streak: Optional[int] = Field(None, ge=0, description="Set current_streak (alias for set_streak, for campaign testing)")
    clear_achievements: bool = Field(False, description="Remove all earned achievements for this user")
    check_achievements: bool = Field(True, description="Re-check achievement conditions after applying changes")
    advance_chapter: bool = Field(False, description="Try to advance campaign chapter after applying changes")
    reset_campaign_progress: bool = Field(False, description="Reset campaign_path to None and current_chapter_id back to chapter 1")
    clear_campaign_path: bool = Field(False, description="Clear campaign_path back to None without a full reset")
    full_reset: bool = Field(False, description="Delete all workouts, missions, achievements and zero all progress counters")


class TimeTravelResponse(BaseModel):
    total_workouts: int
    current_streak: int
    missions_completed_count: int
    level: int
    xp: int
    coins: int
    campaign_path: Optional[str]
    achievements_cleared: bool
    new_achievements: list[str]
    chapter_advanced: bool


class SeedWorkoutHistoryRequest(BaseModel):
    count: int = Field(default=5, ge=1, le=100, description="Number of workouts to generate")
    days_back: int = Field(default=30, ge=1, le=365, description="Spread workouts over this many days")
    consecutive: bool = Field(False, description="If true, place workouts on consecutive days (builds streak)")
    exercises_per_workout: int = Field(default=3, ge=1, le=10, description="Exercises per workout")
    update_progress: bool = Field(True, description="Update UserProgress counters after seeding")
    check_achievements: bool = Field(True, description="Check achievement conditions after seeding")


class SeedWorkoutHistoryResponse(BaseModel):
    workouts_created: int
    total_workouts: int
    current_streak: int
    xp: int
    level: int
    new_achievements: list[str]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/time-travel", response_model=TimeTravelResponse)
def time_travel(
    body: TimeTravelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Directly manipulate user progress counters for testing.
    Allows setting streak, total_workouts, missions, level, XP, etc.
    """
    _require_dev()

    progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()
    if not progress:
        raise HTTPException(status_code=404, detail="UserProgress not found")

    # ── Full reset: wipe everything and start fresh ───────────────────────────
    if body.full_reset:
        # Delete all workout exercises + workouts
        workout_ids = [
            row.id for row in
            db.query(Workout.id).filter(Workout.user_id == current_user.id).all()
        ]
        if workout_ids:
            db.query(WorkoutExercise).filter(WorkoutExercise.workout_id.in_(workout_ids)).delete(synchronize_session=False)
            db.query(Workout).filter(Workout.user_id == current_user.id).delete(synchronize_session=False)

        # Delete missions and achievements
        db.query(UserMission).filter(UserMission.user_id == current_user.id).delete(synchronize_session=False)
        db.query(UserAchievement).filter(UserAchievement.user_id == current_user.id).delete(synchronize_session=False)

        # Zero all progress fields
        progress.xp                      = 0
        progress.level                   = 1
        progress.coins                   = 0
        progress.current_streak          = 0
        progress.longest_streak          = 0
        progress.total_workouts           = 0
        progress.missions_completed_count = 0
        progress.campaign_started_workouts = 0
        progress.campaign_started_missions = 0
        progress.campaign_path            = None
        progress.last_workout_at          = None

        # Reset to chapter 1 of the first campaign
        first_campaign = (
            db.query(Campaign)
            .filter(Campaign.is_active == True)
            .order_by(Campaign.order_index)
            .first()
        )
        if first_campaign:
            progress.current_campaign_id = first_campaign.id
            first_chapter = (
                db.query(CampaignChapter)
                .filter(CampaignChapter.campaign_id == first_campaign.id)
                .order_by(CampaignChapter.chapter_number)
                .first()
            )
            progress.current_chapter_id = first_chapter.id if first_chapter else None

        db.commit()
        db.refresh(progress)
        return TimeTravelResponse(
            total_workouts=0,
            current_streak=0,
            missions_completed_count=0,
            level=1,
            xp=0,
            coins=0,
            campaign_path=None,
            achievements_cleared=True,
            new_achievements=[],
            chapter_advanced=False,
        )

    # ── Individual field overrides ────────────────────────────────────────────
    if body.set_streak is not None:
        progress.current_streak = body.set_streak
        progress.longest_streak = max(progress.longest_streak or 0, body.set_streak)

    if body.set_total_workouts is not None:
        progress.total_workouts = body.set_total_workouts

    if body.set_missions_completed is not None:
        progress.missions_completed_count = body.set_missions_completed

    # These set the RELATIVE progress within the campaign by adjusting the baseline snapshot
    if body.set_campaign_workouts is not None:
        progress.campaign_started_workouts = (progress.total_workouts or 0) - body.set_campaign_workouts

    if body.set_campaign_missions is not None:
        progress.campaign_started_missions = (progress.missions_completed_count or 0) - body.set_campaign_missions

    if body.set_campaign_streak is not None:
        progress.current_streak = body.set_campaign_streak
        progress.longest_streak = max(progress.longest_streak or 0, body.set_campaign_streak)

    if body.set_level is not None:
        # Keep XP consistent with level so the next real workout doesn't snap it back.
        progress.xp = _xp_floor_for_level(body.set_level)
        progress.level = _recalculate_level(progress.xp)

    if body.set_xp is not None:
        progress.xp = body.set_xp
        progress.level = _recalculate_level(progress.xp)

    if body.set_coins is not None:
        progress.coins = body.set_coins

    if body.set_campaign_path is not None:
        progress.campaign_path = body.set_campaign_path

    if body.reset_campaign_progress:
        progress.campaign_path = None
        if progress.current_campaign_id is not None:
            first_chapter = (
                db.query(CampaignChapter)
                .filter(CampaignChapter.campaign_id == progress.current_campaign_id)
                .order_by(CampaignChapter.chapter_number)
                .first()
            )
            if first_chapter:
                progress.current_chapter_id = first_chapter.id

    if body.clear_campaign_path:
        progress.campaign_path = None

    achievements_cleared = False
    if body.clear_achievements:
        db.query(UserAchievement).filter(UserAchievement.user_id == current_user.id).delete()
        achievements_cleared = True

    db.flush()

    new_achievements: list[str] = []
    if body.check_achievements:
        awarded = check_and_award_achievements(current_user.id, db)
        new_achievements = [a.name for a in awarded]

    chapter_advanced = False
    if body.advance_chapter:
        result = try_advance_chapter(current_user.id, db)
        chapter_advanced = result.get("advanced", False)

    db.commit()
    db.refresh(progress)

    return TimeTravelResponse(
        total_workouts=progress.total_workouts or 0,
        current_streak=progress.current_streak or 0,
        missions_completed_count=progress.missions_completed_count or 0,
        level=progress.level,
        xp=progress.xp,
        coins=progress.coins,
        campaign_path=progress.campaign_path,
        achievements_cleared=achievements_cleared,
        new_achievements=new_achievements,
        chapter_advanced=chapter_advanced,
    )


@router.post("/run-ml")
def trigger_ml(db: Session = Depends(get_db)):
    """Manually run nightly ML predictions. Dev only."""
    _require_dev()
    processed = run_nightly_predictions()
    return {"processed_users": processed}


class SetTrendRequest(BaseModel):
    trend: Literal["improving", "plateau", "declining"]
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    make_eligible: bool = Field(
        default=True,
        description="Backdate created_at so the real nightly job would also pick this user up",
    )


@router.post("/set-trend")
def set_trend(
    body: SetTrendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Force today's ML trend for the current user (dev only).

    This is the fast lever for demoing adaptive missions: set a trend, then open
    Missions and accept one — the target and the explanation chip reflect it
    immediately. No need to wait for the nightly job.
    """
    _require_dev()

    # Optionally make the user pass the 14-day eligibility gate (for the real job).
    if body.make_eligible:
        cutoff = datetime.now(timezone.utc) - timedelta(days=15)
        if current_user.created_at is None or current_user.created_at > cutoff:
            current_user.created_at = cutoff

    today = date.today()
    # Plausible feature/SHAP payloads so the coach + UI have something to show.
    features = {
        "weekly_volume_delta":   {"improving": 0.18, "plateau": 0.0, "declining": -0.18}[body.trend],
        "session_frequency":     {"improving": 0.7,  "plateau": 0.45, "declining": 0.25}[body.trend],
        "load_progression":      {"improving": 1.08, "plateau": 1.0, "declining": 0.92}[body.trend],
        "consistency_score":     {"improving": 0.8,  "plateau": 0.5, "declining": 0.25}[body.trend],
        "nutrition_consistency": 0.5,
    }
    shap = {k: round(v - (0.5 if k == "load_progression" else 0.0), 3) for k, v in features.items()}

    pred = (
        db.query(MlPrediction)
        .filter(MlPrediction.user_id == current_user.id, MlPrediction.prediction_date == today)
        .first()
    )
    if pred:
        pred.trend = body.trend
        pred.confidence = body.confidence
        pred.features_json = features
        pred.shap_values = shap
        pred.model_version = "debug"
    else:
        pred = MlPrediction(
            user_id=current_user.id,
            prediction_date=today,
            trend=body.trend,
            confidence=body.confidence,
            features_json=features,
            shap_values=shap,
            model_version="debug",
        )
        db.add(pred)

    db.flush()  # ensure pred.id is set

    # Regenerate the coach message for this prediction so the inbox + insight
    # modal reflect the new trend right away (LLM if configured, else template).
    coach_text = None
    try:
        db.query(CoachMessage).filter(CoachMessage.prediction_id == pred.id).delete()
        msg = generate_message(current_user.id, pred, db)
        coach_text = msg.message_text if msg else None
    except Exception:
        pass

    db.commit()
    return {
        "trend": body.trend,
        "confidence": body.confidence,
        "prediction_date": str(today),
        "eligible_backdated": body.make_eligible,
        "coach_message": coach_text,
    }


@router.get("/llm-check")
def llm_check():
    """
    Report whether the OpenRouter LLM is reachable from THIS running process.
    Dev only. Use this to diagnose 'the coach isn't using the LLM':
      - api_key_loaded == False  → .env not loaded (start uvicorn from backend/)
      - ok == False with a 4xx   → bad model id / rate limit / account setting
      - ok == True               → LLM works; coach messages will use it
    """
    _require_dev()
    from app.services import llm_service

    result: dict = {
        "api_key_loaded": bool(settings.OPENROUTER_API_KEY),
        "primary_model":  settings.OPENROUTER_PRIMARY_MODEL,
        "fallback_model": settings.OPENROUTER_FALLBACK_MODEL,
    }
    if not settings.OPENROUTER_API_KEY:
        result["ok"] = False
        result["detail"] = "OPENROUTER_API_KEY is empty in this process — .env not loaded. Start uvicorn from the backend/ directory."
        return result
    try:
        result["sample"] = llm_service.generate_coach_message(
            trend="improving",
            confidence=0.9,
            shap_values={"weekly_volume_delta": 0.4, "consistency_score": 0.3},
            user_context={"experience_level": "beginner", "primary_goal": "strength",
                          "level": 1, "current_streak": 0, "total_workouts": 5},
        )
        result["ok"] = True
    except Exception as e:
        result["ok"] = False
        result["detail"] = f"{type(e).__name__}: {e}"
    return result


@router.post("/seed-workout-history", response_model=SeedWorkoutHistoryResponse)
def seed_workout_history(
    body: SeedWorkoutHistoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate fake workout history for the current user.
    Useful for testing streaks, campaign progression, and achievements.
    """
    _require_dev()

    # Get available exercises (non-custom ones)
    exercises = db.query(ExerciseLibrary).filter(ExerciseLibrary.is_custom == False).limit(20).all()
    if not exercises:
        raise HTTPException(status_code=400, detail="No exercises in library. Run seed_exercises first.")

    progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()
    if not progress:
        raise HTTPException(status_code=404, detail="UserProgress not found")

    today = date.today()
    created_count = 0
    total_seeded_xp = 0

    for i in range(body.count):
        if body.consecutive:
            # Place workouts on consecutive days ending at today
            workout_date = today - timedelta(days=body.count - 1 - i)
        else:
            # Spread randomly over days_back
            workout_date = today - timedelta(days=random.randint(0, body.days_back - 1))

        workout = Workout(
            user_id=current_user.id,
            workout_date=workout_date,
            duration_minutes=random.randint(30, 90),
            notes=f"Debug workout #{i+1}",
            synced=True,
        )
        db.add(workout)
        db.flush()

        # Add exercises, accumulating volume so XP matches a real logged workout.
        selected = random.sample(exercises, min(body.exercises_per_workout, len(exercises)))
        workout_volume = 0.0
        for j, ex in enumerate(selected):
            sets   = random.randint(3, 5)
            reps   = random.randint(6, 15)
            weight = round(random.uniform(20, 100), 1)
            db.add(WorkoutExercise(
                workout_id=workout.id,
                exercise_id=ex.id,
                sets=sets,
                reps=reps,
                weight_kg=weight,
                order_index=j,
            ))
            workout_volume += sets * reps * weight

        # Same XP formula as a real workout — single source of truth.
        total_seeded_xp += (
            BASE_XP_PER_WORKOUT
            + len(selected) * XP_PER_EXERCISE
            + int(workout_volume / 1000) * XP_PER_1000KG_VOL
        )
        created_count += 1

    # Update progress counters
    if body.update_progress:
        total = db.query(Workout).filter(Workout.user_id == current_user.id).count()
        progress.total_workouts = total

        if body.consecutive:
            progress.current_streak = body.count
            progress.longest_streak = max(progress.longest_streak or 0, body.count)
            progress.last_workout_at = datetime.now(timezone.utc)

        progress.xp += total_seeded_xp
        progress.coins += 10 * body.count
        # Real fixed-threshold leveling (1-5), so it never jumps then snaps back.
        progress.level = _recalculate_level(progress.xp)

    db.flush()

    new_achievements: list[str] = []
    if body.check_achievements:
        awarded = check_and_award_achievements(current_user.id, db)
        new_achievements = [a.name for a in awarded]

    # Try to advance campaign (return value intentionally unused here)
    try_advance_chapter(current_user.id, db)  # noqa: F841

    db.commit()
    db.refresh(progress)

    return SeedWorkoutHistoryResponse(
        workouts_created=created_count,
        total_workouts=progress.total_workouts or 0,
        current_streak=progress.current_streak or 0,
        xp=progress.xp,
        level=progress.level,
        new_achievements=new_achievements,
    )
