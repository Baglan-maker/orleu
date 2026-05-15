from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.models import User, PersonalRecord, PersonalRecordHistory
from app.models.workout import ExerciseLibrary
from app.services.dependencies import get_current_user

router = APIRouter()


class PRCurrentOut(BaseModel):
    exercise_id:    UUID
    exercise_name:  str
    muscle_group:   str
    weight_kg:      float
    achieved_at:    datetime
    total_pr_count: int   # how many times a new record was set on this exercise

    model_config = {"from_attributes": True}


class PRHistoryEntry(BaseModel):
    id:          UUID
    weight_kg:   float
    achieved_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[PRCurrentOut])
def get_all_prs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current best weight PR for every exercise the user has lifted."""
    rows = (
        db.query(PersonalRecord)
        .filter(PersonalRecord.user_id == current_user.id)
        .order_by(PersonalRecord.achieved_at.desc())
        .all()
    )

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
            weight_kg=pr.weight_kg,
            achieved_at=pr.achieved_at,
            total_pr_count=counts.get(pr.exercise_id, 0),
        ))
    return result


@router.delete("/reset", status_code=204)
def reset_prs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all personal records and history for the current user."""
    db.query(PersonalRecordHistory).filter(
        PersonalRecordHistory.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.query(PersonalRecord).filter(
        PersonalRecord.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()


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
        PRHistoryEntry(id=r.id, weight_kg=r.weight_kg, achieved_at=r.achieved_at)
        for r in rows
    ]
