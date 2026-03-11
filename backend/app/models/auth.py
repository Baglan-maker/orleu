# app/models/auth.py
from sqlalchemy import Boolean, Column, DateTime, SmallInteger, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base
from app.models.core import uuid_pk, now_utc

class User(Base):
    __tablename__ = "users"

    id               = uuid_pk()
    email            = Column(String(255), unique=True, nullable=False, index=True)
    password_hash    = Column(String(255), nullable=False)
    name             = Column(String(100), nullable=False)
    avatar_theme_id  = Column(SmallInteger, default=0)
    experience_level = Column(String(20), nullable=False, default="beginner")
    primary_goal     = Column(String(20), nullable=False, default="strength")
    onboarding_done  = Column(Boolean, default=False)
    created_at       = now_utc()
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships (строковые ссылки предотвращают циклические импорты)
    sessions         = relationship("UserSession",     back_populates="user", cascade="all, delete-orphan")
    workouts         = relationship("Workout",         back_populates="user", cascade="all, delete-orphan")
    progress         = relationship("UserProgress",    back_populates="user", uselist=False, cascade="all, delete-orphan")
    missions         = relationship("UserMission",     back_populates="user", cascade="all, delete-orphan")
    predictions      = relationship("MlPrediction",    back_populates="user", cascade="all, delete-orphan")
    coach_messages   = relationship("CoachMessage",    back_populates="user", cascade="all, delete-orphan")
    achievements     = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    skill_nodes      = relationship("UserSkillTree",   back_populates="user", cascade="all, delete-orphan")
    custom_exercises = relationship("ExerciseLibrary", back_populates="creator")

    def __repr__(self):
        return f"<User {self.email}>"


class UserSession(Base):
    __tablename__ = "user_sessions"

    id                 = uuid_pk()
    user_id            = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_hash = Column(String(255), nullable=False, unique=True)
    device_info        = Column(String(255))
    expires_at         = Column(DateTime(timezone=True), nullable=False)
    created_at         = now_utc()

    user = relationship("User", back_populates="sessions")