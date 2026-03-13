from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List

from app.db.database import get_db
from app.models import User, ExerciseLibrary
from app.schemas.exercise import ExerciseCreate, ExerciseOut, MUSCLE_GROUPS, CATEGORIES
from app.services.dependencies import get_current_user

router = APIRouter()


@router.get("/cache", response_model=List[ExerciseOut])
def get_exercise_cache(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Весь список для офлайн кэша мобилки. Системные + кастомные текущего юзера."""
    return (
        db.query(ExerciseLibrary)
        .filter(or_(
            ExerciseLibrary.is_custom == False,
            ExerciseLibrary.created_by == current_user.id,
        ))
        .order_by(ExerciseLibrary.name)
        .all()
    )


@router.get("", response_model=List[ExerciseOut])
def search_exercises(
    q:     str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Поиск по name и alias. Фронт вызывает только при q >= 3 символов,
    при меньших — использует офлайн кэш.
    """
    if len(q) < 3:
        raise HTTPException(status_code=400, detail="Минимум 3 символа для серверного поиска.")

    pattern = f"%{q.lower()}%"
    return (
        db.query(ExerciseLibrary)
        .filter(
            or_(
                ExerciseLibrary.is_custom == False,
                ExerciseLibrary.created_by == current_user.id,
            ),
            or_(
                func.lower(ExerciseLibrary.name).like(pattern),
                func.lower(ExerciseLibrary.alias).like(pattern),
            ),
        )
        .order_by(
            func.lower(ExerciseLibrary.name).like(f"{q.lower()}%").desc(),
            ExerciseLibrary.name,
        )
        .limit(limit)
        .all()
    )


@router.post("", response_model=ExerciseOut, status_code=201)
def create_custom_exercise(
    payload: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создать кастомное упражнение для текущего юзера."""
    if payload.muscle_group not in MUSCLE_GROUPS:
        raise HTTPException(status_code=422, detail=f"muscle_group: {MUSCLE_GROUPS}")
    if payload.category not in CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category: {CATEGORIES}")

    duplicate = (
        db.query(ExerciseLibrary)
        .filter(
            ExerciseLibrary.created_by == current_user.id,
            func.lower(ExerciseLibrary.name) == payload.name.lower(),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail=f"Упражнение '{payload.name}' уже существует")

    exercise = ExerciseLibrary(
        name=payload.name,
        alias=payload.alias,
        muscle_group=payload.muscle_group,
        category=payload.category,
        is_custom=True,
        created_by=current_user.id,
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise