from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User, UserProgress, Campaign, CampaignChapter, Workout, Achievement, UserAchievement
from app.models.ml import MlPrediction
from app.schemas.gamification import ProgressOut, PatchProgressRequest, AchievementOut
from app.schemas.ml import MlStatusOut
from app.services.dependencies import get_current_user
from app.services.gamification_service import try_advance_chapter

router = APIRouter()

# Doc Section 9 — Avatar stages by total workout count
_AVATAR_STAGES = [
    (51, 4, "Legend"),
    (31, 3, "Champion"),
    (16, 2, "Athlete"),
    (6,  1, "Active"),
    (0,  0, "Rookie"),
]


def _avatar_stage(total_sessions: int) -> tuple[int, str]:
    for threshold, stage, name in _AVATAR_STAGES:
        if total_sessions >= threshold:
            return stage, name
    return 0, "Rookie"


def _build_progress_out(
    progress: UserProgress,
    total_sessions: int,
    achievements: list[AchievementOut] | None = None,
) -> ProgressOut:
    stage, stage_name = _avatar_stage(total_sessions)
    return ProgressOut(
        user_id=progress.user_id,
        xp=progress.xp,
        level=progress.level,
        coins=progress.coins,
        current_streak=progress.current_streak,
        longest_streak=progress.longest_streak,
        current_campaign_id=progress.current_campaign_id,
        current_chapter_id=progress.current_chapter_id,
        campaign_path=progress.campaign_path,
        last_workout_at=progress.last_workout_at,
        updated_at=progress.updated_at,
        total_sessions=total_sessions,
        total_workouts=progress.total_workouts or 0,
        missions_completed_count=progress.missions_completed_count or 0,
        campaign_started_workouts=progress.campaign_started_workouts or 0,
        campaign_started_missions=progress.campaign_started_missions or 0,
        avatar_stage=stage,
        avatar_stage_name=stage_name,
        achievements=achievements or [],
    )


@router.get("", response_model=ProgressOut)
def get_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Возвращает game state текущего юзера (xp, level, streak, campaign)."""
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).first()

    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")

    total_sessions = db.query(Workout).filter(Workout.user_id == current_user.id).count()

    earned_map = {
        row.achievement_id: row.earned_at
        for row in db.query(UserAchievement)
        .filter(UserAchievement.user_id == current_user.id)
        .all()
    }
    achievements = [
        AchievementOut(
            id=a.id,
            name=a.name,
            icon_key=a.icon_key,
            earned=a.id in earned_map,
            earned_at=earned_map.get(a.id),
        )
        for a in db.query(Achievement).all()
    ]
    return _build_progress_out(progress, total_sessions, achievements)


@router.get("/ml-status", response_model=MlStatusOut)
def get_ml_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the most recent ML prediction for the current user.
    Cold start: <14 days registered OR <3 workouts → available=False with reason.
    """
    # Eligibility check — same rules as nightly_ml.py so the message stays consistent
    age = datetime.now(timezone.utc) - current_user.created_at
    if age < timedelta(days=14):
        days_left = 14 - age.days
        return MlStatusOut(
            available=False,
            cold_start_reason=f"Need {days_left} more days of activity for ML predictions",
        )

    workout_count = (
        db.query(func.count(Workout.id))
        .filter(Workout.user_id == current_user.id)
        .scalar()
    ) or 0
    if workout_count < 3:
        return MlStatusOut(
            available=False,
            cold_start_reason=f"Log {3 - workout_count} more workout(s) to unlock ML insights",
        )

    pred = (
        db.query(MlPrediction)
        .filter(MlPrediction.user_id == current_user.id)
        .order_by(MlPrediction.prediction_date.desc())
        .first()
    )
    if not pred:
        return MlStatusOut(
            available=False,
            cold_start_reason="ML prediction pending — runs nightly at 00:00 UTC",
        )

    shap = pred.shap_values or {}
    top_feature = max(shap.items(), key=lambda kv: kv[1])[0] if shap else None

    return MlStatusOut(
        available=True,
        trend=pred.trend,
        confidence=pred.confidence,
        prediction_date=pred.prediction_date,
        top_feature=top_feature,
        features=pred.features_json,
        shap_values=shap,
    )


@router.patch("", response_model=ProgressOut)
def patch_progress(
    body: PatchProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Обновляет campaign state юзера.
    Используется фронтом при выборе пути A/B на развилке кампании.
    """
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).first()

    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")

    # Validate campaign_id if provided
    if body.current_campaign_id is not None:
        campaign = db.query(Campaign).filter(
            Campaign.id == body.current_campaign_id
        ).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        progress.current_campaign_id = body.current_campaign_id

    # Validate chapter_id if provided — must belong to the user's active campaign
    if body.current_chapter_id is not None:
        chapter = db.query(CampaignChapter).filter(
            CampaignChapter.id == body.current_chapter_id
        ).first()
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        if chapter.campaign_id != progress.current_campaign_id:
            raise HTTPException(status_code=400, detail="Chapter does not belong to the active campaign")
        progress.current_chapter_id = body.current_chapter_id

    if body.campaign_path is not None:
        progress.campaign_path = body.campaign_path

    db.commit()
    db.refresh(progress)

    # After path is saved, try to advance chapter 3 → 4
    if body.campaign_path is not None:
        try_advance_chapter(current_user.id, db)
        db.refresh(progress)

    total_sessions = db.query(Workout).filter(Workout.user_id == current_user.id).count()
    earned_map = {
        row.achievement_id: row.earned_at
        for row in db.query(UserAchievement)
        .filter(UserAchievement.user_id == current_user.id)
        .all()
    }
    achievements = [
        AchievementOut(
            id=a.id, name=a.name, icon_key=a.icon_key,
            earned=a.id in earned_map, earned_at=earned_map.get(a.id),
        )
        for a in db.query(Achievement).all()
    ]
    return _build_progress_out(progress, total_sessions, achievements)
