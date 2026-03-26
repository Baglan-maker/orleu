from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models import User, UserProgress, MissionTemplate, UserMission
from app.schemas.gamification import (
    MissionTemplateOut,
    UserMissionOut,
    AvailableMissionsOut,
)
from app.services.dependencies import get_current_user
from app.api.workouts import MISSION_TYPE_CATEGORY

router = APIRouter()


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

    active_out = [_to_user_mission_out(m) for m in active]
    completed_out = [_to_user_mission_out(m) for m in completed]

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
        # Filter by campaign path if template has a path requirement
        if t.campaign_path_filter and user_path and t.campaign_path_filter != user_path:
            continue
        tmpl_out = MissionTemplateOut.model_validate(t)
        tmpl_out.category = MISSION_TYPE_CATEGORY.get(t.type, t.type)
        available.append(tmpl_out)

    return AvailableMissionsOut(
        active=active_out,
        completed=completed_out,
        available=available,
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

    # Max 2 active missions at a time (lock rows to prevent race condition)
    active_count = (
        db.query(UserMission)
        .with_for_update()
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .all()
    )
    if len(active_count) >= 2:
        raise HTTPException(status_code=400, detail="Maximum 2 active missions. Complete or wait for one to expire.")

    # Scale target based on user level (cap at level 50 to prevent exponential blowup)
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).first()
    level = progress.level if progress else 1
    capped_level = min(level, 50)
    adjusted_target = template.base_target * (template.difficulty_scale ** max(0, capped_level - 1))

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
