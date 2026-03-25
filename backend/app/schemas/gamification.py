from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime


# ─── Achievements ─────────────────────────────────────────────────

class AchievementOut(BaseModel):
    id:        UUID
    name:      str
    icon_key:  str
    earned:    bool
    earned_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AchievementFullOut(BaseModel):
    id:              UUID
    name:            str
    description:     str
    icon_key:        str
    condition_type:  str
    condition_value: int
    earned:          bool
    earned_at:       Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Progress ────────────────────────────────────────────────────

class ProgressOut(BaseModel):
    user_id:                 UUID
    xp:                      int
    level:                   int
    coins:                   int
    current_streak:          int
    longest_streak:          int
    current_campaign_id:     Optional[UUID] = None
    current_chapter_id:      Optional[UUID] = None
    campaign_path:           Optional[str] = None
    last_workout_at:         Optional[datetime] = None
    updated_at:              Optional[datetime] = None
    total_sessions:          int = 0
    total_workouts:          int = 0
    missions_completed_count: int = 0
    avatar_stage:            int = 0
    avatar_stage_name:       str = "Rookie"
    achievements:            List[AchievementOut] = []

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
    reward_xp:      int = 0
    reward_coins:   int = 0

    model_config = {"from_attributes": True}


class ChapterWithStatusOut(BaseModel):
    id:             UUID
    chapter_number: int
    title:          str
    status:         str   # "completed" | "active" | "locked"
    has_branch:     bool
    narrative_text: Optional[str] = None
    branch_a_label: Optional[str] = None
    branch_b_label: Optional[str] = None
    reward_xp:      int = 0
    reward_coins:   int = 0

    model_config = {"from_attributes": True}


class CampaignCurrentOut(BaseModel):
    campaign:        CampaignOut
    current_chapter: Optional[ChapterOut] = None
    chapters:        List[ChapterWithStatusOut]
    campaign_path:   Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Missions ───────────────────────────────────────────────────

class MissionTemplateOut(BaseModel):
    id:                   UUID
    name:                 str
    type:                 str
    description_template: str
    base_target:          float
    base_xp:              int
    base_coins:           int
    duration_days:        int

    model_config = {"from_attributes": True}


class UserMissionOut(BaseModel):
    id:                  UUID
    mission_template_id: UUID
    name:                str
    type:                str
    description:         str
    adjusted_target:     float
    current_progress:    float
    status:              str
    xp_reward:           int
    coins_reward:        int
    started_at:          Optional[datetime] = None
    expires_at:          Optional[datetime] = None
    completed_at:        Optional[datetime] = None

    model_config = {"from_attributes": True}


class AvailableMissionsOut(BaseModel):
    active:    List[UserMissionOut]
    available: List[MissionTemplateOut]
