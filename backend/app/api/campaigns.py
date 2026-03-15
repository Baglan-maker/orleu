from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models import User, Campaign, CampaignChapter
from app.schemas.gamification import CampaignOut, ChapterOut
from app.services.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=List[CampaignOut])
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Все активные кампании, отсортированные по order_index."""
    return (
        db.query(Campaign)
        .filter(Campaign.is_active == True)
        .order_by(Campaign.order_index)
        .all()
    )


@router.get("/{campaign_id}/chapters", response_model=List[ChapterOut])
def list_chapters(
    campaign_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Все главы кампании, отсортированные по chapter_number."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return (
        db.query(CampaignChapter)
        .filter(CampaignChapter.campaign_id == campaign_id)
        .order_by(CampaignChapter.chapter_number)
        .all()
    )
