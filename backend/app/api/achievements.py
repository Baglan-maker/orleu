from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models import User, Achievement, UserAchievement
from app.schemas.gamification import AchievementFullOut
from app.services.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=List[AchievementFullOut])
def list_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns ALL achievements with earned status for the current user.
    Order: earned first (by earned_at desc), then unearned sorted by condition_value asc.
    """
    earned_map = {
        row.achievement_id: row.earned_at
        for row in db.query(UserAchievement)
        .filter(UserAchievement.user_id == current_user.id)
        .all()
    }

    all_achievements = db.query(Achievement).all()

    earned = []
    unearned = []
    for a in all_achievements:
        is_earned = a.id in earned_map
        item = AchievementFullOut(
            id=a.id,
            name=a.name,
            description=a.description,
            icon_key=a.icon_key,
            condition_type=a.condition_type,
            condition_value=a.condition_value,
            earned=is_earned,
            earned_at=earned_map.get(a.id),
        )
        if is_earned:
            earned.append(item)
        else:
            unearned.append(item)

    earned.sort(key=lambda x: x.earned_at or "", reverse=True)
    unearned.sort(key=lambda x: x.condition_value)

    return earned + unearned
