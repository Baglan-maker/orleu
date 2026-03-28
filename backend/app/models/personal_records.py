# app/models/personal_records.py
from sqlalchemy import Column, DateTime, Float, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.models.core import uuid_pk


class PersonalRecord(Base):
    """Current best weight per user + exercise (one row per pair)."""
    __tablename__ = "personal_records"
    __table_args__ = (
        UniqueConstraint("user_id", "exercise_id", name="uq_pr_user_exercise"),
    )

    id          = uuid_pk()
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercise_library.id", ondelete="CASCADE"), nullable=False, index=True)
    weight_kg   = Column(Float, nullable=False)   # current best weight
    achieved_at = Column(DateTime(timezone=True), nullable=False)

    user     = relationship("User")
    exercise = relationship("ExerciseLibrary")


class PersonalRecordHistory(Base):
    """Append-only log — one row every time a new weight PR is set."""
    __tablename__ = "personal_record_history"

    id          = uuid_pk()
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercise_library.id", ondelete="CASCADE"), nullable=False, index=True)
    weight_kg   = Column(Float, nullable=False)
    achieved_at = Column(DateTime(timezone=True), nullable=False)

    user     = relationship("User")
    exercise = relationship("ExerciseLibrary")
