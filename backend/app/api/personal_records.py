# app/api/personal_records.py
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.database import get_db
from app.models import User, PersonalRecord, PersonalRecordHistory
from app.models.workout import ExerciseLibrary
from app.services.dependencies import get_current_user

router = APIRouter()


# ── Response models (inline Pydantic) ─────────────────────────────────────────
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PRCurrentOut(BaseModel):
    exercise_id:     UUID
    exercise_name:   str
    muscle_group:    str
    estimated_1rm:   float
    weight_kg:       float
    reps:            int
    achieved_at:     datetime
    improvement_pct: Optional[float] = None
    total_pr_count:  int

    model_config = {"from_attributes": True}


class PRHistoryEntry(BaseModel):
    id:            UUID
    estimated_1rm: float
    weight_kg:     float
    reps:          int
    achieved_at:   datetime

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PRCurrentOut])
def get_all_prs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current best PR for every exercise the user has lifted."""
    rows = (
        db.query(PersonalRecord)
        .filter(PersonalRecord.user_id == current_user.id)
        .order_by(PersonalRecord.achieved_at.desc())
        .all()
    )

    # Count history entries per exercise in one query
    counts = dict(
        db.query(
            PersonalRecordHistory.exercise_id,
            func.count(PersonalRecordHistory.id),
        )
        .filter(PersonalRecordHistory.user_id == current_user.id)
        .group_by(PersonalRecordHistory.exercise_id)
        .all()
    )

    result = []
    for pr in rows:
        ex: ExerciseLibrary | None = pr.exercise
        result.append(PRCurrentOut(
            exercise_id=pr.exercise_id,
            exercise_name=ex.name if ex else "Unknown",
            muscle_group=ex.muscle_group if ex else "",
            estimated_1rm=pr.estimated_1rm,
            weight_kg=pr.weight_kg,
            reps=pr.reps,
            achieved_at=pr.achieved_at,
            improvement_pct=pr.improvement_pct,
            total_pr_count=counts.get(pr.exercise_id, 1),
        ))
    return result


@router.get("/{exercise_id}", response_model=list[PRHistoryEntry])
def get_pr_history(
    exercise_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full PR history for one exercise, newest first."""
    rows = (
        db.query(PersonalRecordHistory)
        .filter(
            PersonalRecordHistory.user_id == current_user.id,
            PersonalRecordHistory.exercise_id == exercise_id,
        )
        .order_by(PersonalRecordHistory.achieved_at.desc())
        .all()
    )
    return [
        PRHistoryEntry(
            id=r.id,
            estimated_1rm=r.estimated_1rm,
            weight_kg=r.weight_kg,
            reps=r.reps,
            achieved_at=r.achieved_at,
        )
        for r in rows
    ]
