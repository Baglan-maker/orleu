from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User, UserProgress, Campaign, CampaignChapter
from app.schemas.gamification import ProgressOut, PatchProgressRequest
from app.services.dependencies import get_current_user

router = APIRouter()


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

    return progress


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

    # Validate chapter_id if provided
    if body.current_chapter_id is not None:
        chapter = db.query(CampaignChapter).filter(
            CampaignChapter.id == body.current_chapter_id
        ).first()
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        progress.current_chapter_id = body.current_chapter_id

    if body.campaign_path is not None:
        progress.campaign_path = body.campaign_path

    db.commit()
    db.refresh(progress)
    return progress
