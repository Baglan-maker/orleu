from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime


# ─── Progress ────────────────────────────────────────────────────

class ProgressOut(BaseModel):
    user_id:             UUID
    xp:                  int
    level:               int
    coins:               int
    current_streak:      int
    longest_streak:      int
    current_campaign_id: Optional[UUID] = None
    current_chapter_id:  Optional[UUID] = None
    campaign_path:       Optional[str] = None
    last_workout_at:     Optional[datetime] = None
    updated_at:          Optional[datetime] = None

    model_config = {"from_attributes": True}


class PatchProgressRequest(BaseModel):
    campaign_path:       Optional[Literal["A", "B"]] = None
    current_campaign_id: Optional[UUID] = None
    current_chapter_id:  Optional[UUID] = None


# ─── Campaigns ───────────────────────────────────────────────────

class CampaignOut(BaseModel):
    id:             UUID
    name:           str
    description:    Optional[str] = None
    total_chapters: int
    order_index:    int
    is_active:      bool

    model_config = {"from_attributes": True}


class ChapterOut(BaseModel):
    id:             UUID
    campaign_id:    UUID
    chapter_number: int
    title:          str
    narrative_text: Optional[str] = None
    has_branch:     bool
    branch_a_label: Optional[str] = None
    branch_b_label: Optional[str] = None

    model_config = {"from_attributes": True}
