# app/models/workout.py
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base
from app.models.core import uuid_pk, now_utc

class ExerciseLibrary(Base):
    __tablename__ = "exercise_library"

    id           = uuid_pk()
    name         = Column(String(100), nullable=False)
    alias        = Column(String(100))
    muscle_group = Column(String(30), nullable=False)
    category     = Column(String(20), nullable=False)
    is_custom    = Column(Boolean, default=False)
    created_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at   = now_utc()

    creator           = relationship("User", back_populates="custom_exercises")
    workout_exercises = relationship("WorkoutExercise", back_populates="exercise")


class Workout(Base):
    __tablename__ = "workouts"

    id               = uuid_pk()
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workout_date     = Column(Date, nullable=False)
    duration_minutes = Column(Integer)
    notes            = Column(Text)
    synced           = Column(Boolean, default=True)
    created_at       = now_utc()
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user      = relationship("User",            back_populates="workouts")
    exercises = relationship("WorkoutExercise", back_populates="workout", cascade="all, delete-orphan")


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id          = uuid_pk()
    workout_id  = Column(UUID(as_uuid=True), ForeignKey("workouts.id",  ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercise_library.id"), nullable=False, index=True)
    sets        = Column(Integer, nullable=False)
    reps        = Column(Integer, nullable=False)
    weight_kg   = Column(Float,   nullable=False, default=0.0)
    notes       = Column(Text)
    order_index = Column(Integer, default=0)

    workout  = relationship("Workout",         back_populates="exercises")
    exercise = relationship("ExerciseLibrary", back_populates="workout_exercises")