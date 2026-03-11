# app/models/gamification.py
import uuid
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base
from app.models.core import uuid_pk

class Campaign(Base):
    __tablename__ = "campaigns"

    id             = uuid_pk()
    name           = Column(String(100), nullable=False)
    description    = Column(Text)
    total_chapters = Column(Integer, nullable=False)
    order_index    = Column(Integer, nullable=False)
    is_active      = Column(Boolean, default=True)

    chapters = relationship("CampaignChapter", back_populates="campaign", cascade="all, delete-orphan")


class CampaignChapter(Base):
    __tablename__ = "campaign_chapters"
    __table_args__ = (UniqueConstraint("campaign_id", "chapter_number"),)

    id             = uuid_pk()
    campaign_id    = Column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    chapter_number = Column(Integer, nullable=False)
    title          = Column(String(100), nullable=False)
    narrative_text = Column(Text)
    has_branch     = Column(Boolean, default=False)
    branch_a_label = Column(String(100))
    branch_b_label = Column(String(100))

    campaign = relationship("Campaign", back_populates="chapters")


class UserProgress(Base):
    __tablename__ = "user_progress"

    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    xp                  = Column(Integer, default=0)
    level               = Column(Integer, default=1)
    coins               = Column(Integer, default=0)
    current_streak      = Column(Integer, default=0)
    longest_streak      = Column(Integer, default=0)
    current_campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    current_chapter_id  = Column(UUID(as_uuid=True), ForeignKey("campaign_chapters.id"), nullable=True)
    campaign_path       = Column(String(1), nullable=True)
    last_workout_at     = Column(DateTime(timezone=True), nullable=True)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user             = relationship("User",            back_populates="progress")
    current_campaign = relationship("Campaign",        foreign_keys=[current_campaign_id])
    current_chapter  = relationship("CampaignChapter", foreign_keys=[current_chapter_id])


class MissionTemplate(Base):
    __tablename__ = "mission_templates"

    id                   = uuid_pk()
    name                 = Column(String(100), nullable=False)
    type                 = Column(String(20), nullable=False)
    description_template = Column(String(255), nullable=False)
    base_target          = Column(Float, nullable=False)
    difficulty_scale     = Column(Float, nullable=False, default=1.0)
    base_xp              = Column(Integer, nullable=False)
    base_coins           = Column(Integer, nullable=False)
    campaign_path_filter = Column(String(1), nullable=True)
    duration_days        = Column(Integer, nullable=False, default=7)

    user_missions = relationship("UserMission", back_populates="template")


class UserMission(Base):
    __tablename__ = "user_missions"

    id                  = uuid_pk()
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mission_template_id = Column(UUID(as_uuid=True), ForeignKey("mission_templates.id"), nullable=False)
    adjusted_target     = Column(Float, nullable=False)
    current_progress    = Column(Float, default=0.0)
    status              = Column(String(20), default="active")
    xp_awarded          = Column(Integer, nullable=True)
    coins_awarded       = Column(Integer, nullable=True)
    started_at          = Column(DateTime(timezone=True), server_default=func.now())
    expires_at          = Column(DateTime(timezone=True), nullable=False)
    completed_at        = Column(DateTime(timezone=True), nullable=True)

    user     = relationship("User",            back_populates="missions")
    template = relationship("MissionTemplate", back_populates="user_missions")


class SkillTreeNode(Base):
    __tablename__ = "skill_tree_nodes"

    node_id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                 = Column(String(100), nullable=False)
    benefit_description  = Column(Text, nullable=False)
    unlock_cost_coins    = Column(Integer, nullable=False)
    prerequisite_node_id = Column(UUID(as_uuid=True), ForeignKey("skill_tree_nodes.node_id"), nullable=True)

    prerequisite  = relationship("SkillTreeNode", remote_side="SkillTreeNode.node_id")
    user_unlocks  = relationship("UserSkillTree", back_populates="node")


class UserSkillTree(Base):
    __tablename__ = "user_skill_tree"
    __table_args__ = (UniqueConstraint("user_id", "node_id"),)

    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    node_id     = Column(UUID(as_uuid=True), ForeignKey("skill_tree_nodes.node_id"),     primary_key=True)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User",          back_populates="skill_nodes")
    node = relationship("SkillTreeNode", back_populates="user_unlocks")


class Achievement(Base):
    __tablename__ = "achievements"

    id              = uuid_pk()
    name            = Column(String(100), nullable=False)
    description     = Column(String(255), nullable=False)
    icon_key        = Column(String(50),  nullable=False)
    condition_type  = Column(String(50),  nullable=False)
    condition_value = Column(Integer,     nullable=False)

    user_achievements = relationship("UserAchievement", back_populates="achievement")


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id"),)

    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id",      ondelete="CASCADE"), primary_key=True)
    achievement_id = Column(UUID(as_uuid=True), ForeignKey("achievements.id"),                   primary_key=True)
    earned_at      = Column(DateTime(timezone=True), server_default=func.now())

    user        = relationship("User",        back_populates="achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")