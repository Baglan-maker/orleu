from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models import User, Campaign, CampaignChapter, UserProgress
from app.schemas.gamification import CampaignOut, ChapterOut, ChapterWithStatusOut, CampaignCurrentOut
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


@router.get("/current", response_model=CampaignCurrentOut)
def get_current_campaign(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the user's active campaign with per-chapter statuses."""
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).first()

    if not progress or not progress.current_campaign_id:
        raise HTTPException(status_code=404, detail="No active campaign")

    campaign = db.query(Campaign).filter(Campaign.id == progress.current_campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    chapters = (
        db.query(CampaignChapter)
        .filter(CampaignChapter.campaign_id == campaign.id)
        .order_by(CampaignChapter.chapter_number)
        .all()
    )

    current_chapter = (
        db.query(CampaignChapter)
        .filter(CampaignChapter.id == progress.current_chapter_id)
        .first()
    ) if progress.current_chapter_id else None

    current_num = current_chapter.chapter_number if current_chapter else 0

    chapters_with_status = [
        ChapterWithStatusOut(
            id=ch.id,
            chapter_number=ch.chapter_number,
            title=ch.title,
            status=(
                "completed" if ch.chapter_number < current_num
                else "active" if ch.chapter_number == current_num
                else "locked"
            ),
            has_branch=ch.has_branch,
            narrative_text=ch.narrative_text,
            branch_a_label=ch.branch_a_label,
            branch_b_label=ch.branch_b_label,
        )
        for ch in chapters
    ]

    return CampaignCurrentOut(
        campaign=CampaignOut.model_validate(campaign),
        current_chapter=ChapterOut.model_validate(current_chapter) if current_chapter else None,
        chapters=chapters_with_status,
        campaign_path=progress.campaign_path,
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
