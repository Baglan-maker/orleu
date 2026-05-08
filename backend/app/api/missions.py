from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
import random
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models import User, UserProgress, MissionTemplate, UserMission
from app.models.ml import MlPrediction
from app.schemas.gamification import (
    MissionTemplateOut,
    UserMissionOut,
    AvailableMissionsOut,
)
from app.services.dependencies import get_current_user
from app.api.workouts import MISSION_TYPE_CATEGORY

router = APIRouter()

# Reroll config — once per 7 days, fixed coin cost.
# Kept here (not in DB) because tuning shouldn't require a migration; bump if
# economy changes. The cost intentionally stings a little so reroll feels like
# a real choice, not a free re-spin until you like the offer.
REROLL_COST_COINS = 30
REROLL_COOLDOWN_DAYS = 7


def _reroll_status(progress: UserProgress | None, now: datetime) -> tuple[bool, datetime | None]:
    """Return (available, next_available_at)."""
    if progress is None or progress.last_mission_reroll_at is None:
        return True, None
    next_at = progress.last_mission_reroll_at + timedelta(days=REROLL_COOLDOWN_DAYS)
    if now >= next_at:
        return True, None
    return False, next_at


def _to_user_mission_out(um: UserMission) -> UserMissionOut:
    tmpl = um.template
    # Use base_target in the description text so it matches what was shown on the selection card.
    # adjusted_target (level-scaled) is used only for progress math, not the display label.
    desc = tmpl.description_template.replace("{target}", str(int(tmpl.base_target)))
    return UserMissionOut(
        id=um.id,
        mission_template_id=um.mission_template_id,
        name=tmpl.name,
        type=tmpl.type,
        description=desc,
        adjusted_target=um.adjusted_target,
        current_progress=um.current_progress,
        status=um.status,
        xp_reward=tmpl.base_xp,
        coins_reward=tmpl.base_coins,
        started_at=um.started_at,
        expires_at=um.expires_at,
        completed_at=um.completed_at,
    )


@router.get("", response_model=AvailableMissionsOut)
def get_missions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the user's active missions + available templates they can pick from.
    """
    now = datetime.now(timezone.utc)

    # Active missions (not expired, not completed)
    active = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .all()
    )

    # Recently completed (last 7 days)
    completed = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "completed",
            UserMission.completed_at > now - timedelta(days=7),
        )
        .all()
    )

    # Recently expired (last 7 days) — surfaced once to the user, then dismissed client-side
    expired = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "expired",
            UserMission.expires_at > now - timedelta(days=7),
        )
        .all()
    )

    active_out = [_to_user_mission_out(m) for m in active]
    completed_out = [_to_user_mission_out(m) for m in completed]
    expired_out = [_to_user_mission_out(m) for m in expired]

    # Available templates (exclude ones the user already has active)
    active_template_ids = {m.mission_template_id for m in active}
    all_templates = db.query(MissionTemplate).all()

    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).first()
    user_path = progress.campaign_path if progress else None

    available = []
    for t in all_templates:
        if t.id in active_template_ids:
            continue
        # Filter by campaign path: hide path-specific missions until user has chosen a path
        if t.campaign_path_filter:
            if not user_path or t.campaign_path_filter != user_path:
                continue
        tmpl_out = MissionTemplateOut.model_validate(t)
        tmpl_out.category = MISSION_TYPE_CATEGORY.get(t.type, t.type)
        available.append(tmpl_out)

    # ML-driven ordering: nudge users toward missions matching their current trend.
    # base_xp is the difficulty proxy — designer-tuned reward per mission.
    latest_pred = (
        db.query(MlPrediction)
        .filter(MlPrediction.user_id == current_user.id)
        .order_by(MlPrediction.prediction_date.desc())
        .first()
    )
    trend = latest_pred.trend if latest_pred else None
    if trend == "improving":
        available.sort(key=lambda m: m.base_xp, reverse=True)   # hardest first
    elif trend == "declining":
        available.sort(key=lambda m: m.base_xp)                 # easiest first
    # plateau → leave default order (no nudge in either direction)

    reroll_available, next_reroll_at = _reroll_status(progress, now)

    return AvailableMissionsOut(
        active=active_out,
        completed=completed_out,
        expired=expired_out,
        available=available,
        trend=trend,
        reroll_available=reroll_available,
        reroll_cost=REROLL_COST_COINS,
        next_reroll_at=next_reroll_at,
    )


@router.post("/{template_id}/accept", response_model=UserMissionOut, status_code=201)
def accept_mission(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a mission template — creates a UserMission with adjusted target."""
    template = db.query(MissionTemplate).filter(MissionTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Mission template not found")


    # Defense-in-depth: path-locked templates require a matching campaign_path.
    # The /missions list already filters these out, but a client cannot bypass
    # the gate by accepting a known template id directly.
    if template.campaign_path_filter:
        progress_for_path = db.query(UserProgress).filter(
            UserProgress.user_id == current_user.id
        ).first()
        user_path = progress_for_path.campaign_path if progress_for_path else None
        if not user_path or template.campaign_path_filter != user_path:
            raise HTTPException(
                status_code=403,
                detail="This mission requires a matching campaign path. Choose your path first.",
            )

    # Check if already active
    now = datetime.now(timezone.utc)
    existing = (
        db.query(UserMission)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.mission_template_id == template_id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Mission already active")

    # Lock the user's progress row to serialize all mission accepts for this user.
    # This prevents the race where 0 active missions exist (no rows to lock),
    # allowing 3+ concurrent accepts to all pass the limit check.
    db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).with_for_update().first()

    # Max 2 active missions at a time (serialized by the progress lock above)
    active_count = (
        db.query(UserMission)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .all()
    )
    if len(active_count) >= 2:
        raise HTTPException(status_code=400, detail="Maximum 2 active missions. Complete or wait for one to expire.")

    # Scale target based on user level.
    # Cap the multiplier at 5x base to prevent impossible targets at high levels.
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).first()
    level = progress.level if progress else 1
    capped_level = min(level, 50)
    raw_target = template.base_target * (template.difficulty_scale ** max(0, capped_level - 1))
    max_target = template.base_target * 5.0
    adjusted_target = min(raw_target, max_target)

    mission = UserMission(
        user_id=current_user.id,
        mission_template_id=template_id,
        adjusted_target=round(adjusted_target, 1),
        current_progress=0.0,
        status="active",
        expires_at=now + timedelta(days=template.duration_days),
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    # Load template for response
    mission = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(UserMission.id == mission.id)
        .first()
    )
    return _to_user_mission_out(mission)


@router.post("/{user_mission_id}/reroll", response_model=UserMissionOut, status_code=200)
def reroll_mission(
    user_mission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace one active mission with a randomly-picked different template.

    Rate-limited to once per `REROLL_COOLDOWN_DAYS` and costs `REROLL_COST_COINS`.
    Intended for cases where the assigned mission is physically unfeasible
    (injury, equipment access, etc.) — not a free re-roll until you like the offer.
    """
    now = datetime.now(timezone.utc)

    # Lock the progress row to serialize coin debit + reroll-timestamp update
    progress = (
        db.query(UserProgress)
        .filter(UserProgress.user_id == current_user.id)
        .with_for_update()
        .first()
    )
    if progress is None:
        raise HTTPException(status_code=404, detail="User progress not found")

    # Cooldown gate
    available, next_at = _reroll_status(progress, now)
    if not available:
        raise HTTPException(
            status_code=429,
            detail=f"Reroll on cooldown. Next available at {next_at.isoformat() if next_at else 'unknown'}.",
        )

    # Coin gate
    if progress.coins < REROLL_COST_COINS:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough coins. Reroll costs {REROLL_COST_COINS}, you have {progress.coins}.",
        )

    # Find the mission to reroll — must be active and owned by the user
    target = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.id == user_mission_id,
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .first()
    )
    if target is None:
        raise HTTPException(status_code=404, detail="Active mission not found")

    # Pool of replacement templates: respect path filter, exclude the current
    # template (no point swapping to the same one) and any other actives.
    other_active_ids = {
        m.mission_template_id
        for m in db.query(UserMission)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
            UserMission.id != target.id,
        )
        .all()
    }
    user_path = progress.campaign_path

    candidates: list[MissionTemplate] = []
    for t in db.query(MissionTemplate).all():
        if t.id == target.mission_template_id:
            continue
        if t.id in other_active_ids:
            continue
        if t.campaign_path_filter:
            if not user_path or t.campaign_path_filter != user_path:
                continue
        candidates.append(t)

    if not candidates:
        raise HTTPException(status_code=409, detail="No alternative missions available to reroll into.")

    new_template = random.choice(candidates)

    # Mark the old mission as rerolled so progress history is preserved
    target.status = "rerolled"

    # Scale target same way as accept
    capped_level = min(progress.level, 50)
    raw_target = new_template.base_target * (
        new_template.difficulty_scale ** max(0, capped_level - 1)
    )
    max_target = new_template.base_target * 5.0
    adjusted_target = min(raw_target, max_target)

    new_mission = UserMission(
        user_id=current_user.id,
        mission_template_id=new_template.id,
        adjusted_target=round(adjusted_target, 1),
        current_progress=0.0,
        status="active",
        expires_at=now + timedelta(days=new_template.duration_days),
    )
    db.add(new_mission)

    # Charge coins + start the cooldown
    progress.coins -= REROLL_COST_COINS
    progress.last_mission_reroll_at = now

    db.commit()
    db.refresh(new_mission)

    new_mission = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(UserMission.id == new_mission.id)
        .first()
    )
    return _to_user_mission_out(new_mission)
