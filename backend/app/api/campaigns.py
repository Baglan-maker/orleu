from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models import User, Campaign, CampaignChapter, UserProgress
from app.schemas.gamification import (
    CampaignOut, ChapterOut, ChapterWithStatusOut, CampaignCurrentOut, ChapterRequirementOut,
)
from app.services.dependencies import get_current_user
from app.services.gamification_service import CHAPTER_REWARDS, get_chapter_requirements

router = APIRouter()


def _chapter_rewards(chapter_number: int) -> tuple[int, int]:
    """Return (reward_xp, reward_coins) for the given chapter number."""
    r = CHAPTER_REWARDS.get(chapter_number, {"xp": 0, "coins": 0})
    return r["xp"], r["coins"]


@router.get("", response_model=List[CampaignOut])
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All active campaigns sorted by order_index."""
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
            reward_xp=_chapter_rewards(ch.chapter_number)[0],
            reward_coins=_chapter_rewards(ch.chapter_number)[1],
        )
        for ch in chapters
    ]

    # Build live requirements for the active chapter only
    requirements: list[ChapterRequirementOut] = []
    if current_chapter:
        raw_reqs = get_chapter_requirements(current_user.id, progress, current_chapter, db)
        requirements = [
            ChapterRequirementOut(
                label=r.label,
                current=r.current,
                target=r.target,
                met=r.met,
            )
            for r in raw_reqs
        ]

    return CampaignCurrentOut(
        campaign=CampaignOut.model_validate(campaign),
        current_chapter=ChapterOut.model_validate(current_chapter) if current_chapter else None,
        chapters=chapters_with_status,
        campaign_path=progress.campaign_path,
        requirements=requirements,
    )


@router.get("/{campaign_id}/chapters", response_model=List[ChapterOut])
def list_chapters(
    campaign_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All chapters for a campaign sorted by chapter_number."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    chapters = (
        db.query(CampaignChapter)
        .filter(CampaignChapter.campaign_id == campaign_id)
        .order_by(CampaignChapter.chapter_number)
        .all()
    )

    return [
        ChapterOut(
            id=ch.id,
            campaign_id=ch.campaign_id,
            chapter_number=ch.chapter_number,
            title=ch.title,
            narrative_text=ch.narrative_text,
            has_branch=ch.has_branch,
            branch_a_label=ch.branch_a_label,
            branch_b_label=ch.branch_b_label,
            reward_xp=_chapter_rewards(ch.chapter_number)[0],
            reward_coins=_chapter_rewards(ch.chapter_number)[1],
        )
        for ch in chapters
    ]
