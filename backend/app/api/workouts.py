from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models import User, Workout, ExerciseLibrary
from app.models.workout import WorkoutExercise
from app.schemas.workout import (
    WorkoutCreate, WorkoutOut, WorkoutExerciseOut,
    WorkoutListItem, WorkoutListResponse,
)
from app.services.dependencies import get_current_user

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _to_exercise_out(we: WorkoutExercise) -> WorkoutExerciseOut:
    return WorkoutExerciseOut(
        id=we.id,
        exercise_id=we.exercise_id,
        exercise_name=we.exercise.name if we.exercise else "Unknown",
        muscle_group=we.exercise.muscle_group if we.exercise else "",
        sets=we.sets,
        reps=we.reps,
        weight_kg=we.weight_kg,
        notes=we.notes,
        order_index=we.order_index,
        total_volume=round(we.sets * we.reps * we.weight_kg, 2),
    )


def _to_workout_out(workout: Workout) -> WorkoutOut:
    ex_out = [_to_exercise_out(we) for we in workout.exercises]
    return WorkoutOut(
        id=workout.id,
        user_id=workout.user_id,
        workout_date=workout.workout_date,
        duration_minutes=workout.duration_minutes,
        notes=workout.notes,
        synced=workout.synced,
        exercises=ex_out,
        total_volume=round(sum(e.total_volume for e in ex_out), 2),
        created_at=workout.created_at,
        updated_at=workout.updated_at,
    )


def _load_with_exercises(db: Session, workout_id: UUID) -> List[WorkoutExercise]:
    return (
        db.query(WorkoutExercise)
        .options(joinedload(WorkoutExercise.exercise))
        .filter(WorkoutExercise.workout_id == workout_id)
        .order_by(WorkoutExercise.order_index)
        .all()
    )


def _get_own_workout(db: Session, workout_id: UUID, user_id: UUID) -> Workout:
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Тренировка не найдена")
    if workout.user_id != user_id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return workout


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=WorkoutOut, status_code=201)
def create_workout(
    payload: WorkoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Проверить что все exercise_id существуют и доступны юзеру
    ex_ids    = [str(e.exercise_id) for e in payload.exercises]
    found     = db.query(ExerciseLibrary).filter(ExerciseLibrary.id.in_(ex_ids)).all()
    found_map = {str(e.id): e for e in found}

    missing = [eid for eid in ex_ids if eid not in found_map]
    if missing:
        raise HTTPException(status_code=422, detail=f"Неизвестные exercise_id: {missing}")

    for ex in found:
        if ex.is_custom and ex.created_by != current_user.id:
            raise HTTPException(status_code=403, detail=f"Упражнение '{ex.name}' недоступно")

    # Сохранить тренировку
    workout = Workout(
        user_id=current_user.id,
        workout_date=payload.workout_date,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
        synced=True,
    )
    db.add(workout)
    db.flush()

    for item in payload.exercises:
        db.add(WorkoutExercise(
            workout_id=workout.id,
            exercise_id=item.exercise_id,
            sets=item.sets,
            reps=item.reps,
            weight_kg=item.weight_kg,
            notes=item.notes,
            order_index=item.order_index,
        ))

    db.commit()
    workout.exercises = _load_with_exercises(db, workout.id)
    db.refresh(workout)
    return _to_workout_out(workout)


@router.get("", response_model=WorkoutListResponse)
def list_workouts(
    limit:  int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0,  ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base  = db.query(Workout).filter(Workout.user_id == current_user.id)
    total = base.count()
    rows  = (
        base
        .order_by(Workout.workout_date.desc(), Workout.created_at.desc())
        .offset(offset).limit(limit)
        .all()
    )

    items = []
    for w in rows:
        exercises = db.query(WorkoutExercise).filter(WorkoutExercise.workout_id == w.id).all()
        vol = sum(e.sets * e.reps * e.weight_kg for e in exercises)
        items.append(WorkoutListItem(
            id=w.id,
            workout_date=w.workout_date,
            duration_minutes=w.duration_minutes,
            notes=w.notes,
            total_exercises=len(exercises),
            total_volume=round(vol, 2),
            created_at=w.created_at,
        ))

    return WorkoutListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{workout_id}", response_model=WorkoutOut)
def get_workout(
    workout_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout = _get_own_workout(db, workout_id, current_user.id)
    workout.exercises = _load_with_exercises(db, workout_id)
    return _to_workout_out(workout)


@router.delete("/{workout_id}", status_code=204)
def delete_workout(
    workout_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout = _get_own_workout(db, workout_id, current_user.id)
    db.delete(workout)
    db.commit()