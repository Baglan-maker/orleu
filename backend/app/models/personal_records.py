# app/models/personal_records.py
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.models.core import uuid_pk, now_utc


class PersonalRecord(Base):
    """Current best (one row per user + exercise)."""
    __tablename__ = "personal_records"
    __table_args__ = (
        UniqueConstraint("user_id", "exercise_id", name="uq_pr_user_exercise"),
    )

    id            = uuid_pk()
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id   = Column(UUID(as_uuid=True), ForeignKey("exercise_library.id", ondelete="CASCADE"), nullable=False, index=True)
    estimated_1rm = Column(Float, nullable=False)
    weight_kg     = Column(Float, nullable=False)
    reps          = Column(Integer, nullable=False)
    sets          = Column(Integer, nullable=False)
    achieved_at   = Column(DateTime(timezone=True), nullable=False)
    previous_1rm  = Column(Float, nullable=True)
    improvement_pct = Column(Float, nullable=True)

    user     = relationship("User")
    exercise = relationship("ExerciseLibrary")


class PersonalRecordHistory(Base):
    """Append-only log of every time a PR was set."""
    __tablename__ = "personal_record_history"

    id            = uuid_pk()
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id   = Column(UUID(as_uuid=True), ForeignKey("exercise_library.id", ondelete="CASCADE"), nullable=False, index=True)
    estimated_1rm = Column(Float, nullable=False)
    weight_kg     = Column(Float, nullable=False)
    reps          = Column(Integer, nullable=False)
    achieved_at   = Column(DateTime(timezone=True), nullable=False)

    user     = relationship("User")
    exercise = relationship("ExerciseLibrary")
