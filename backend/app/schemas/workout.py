from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date


class WorkoutExerciseIn(BaseModel):
    exercise_id: UUID
    sets:        int   = Field(..., ge=1, le=100)
    reps:        int   = Field(..., ge=1, le=1000)
    weight_kg:   float = Field(default=0.0, ge=0.0)
    notes:       Optional[str] = None
    order_index: int   = Field(default=0, ge=0)


class WorkoutExerciseOut(BaseModel):
    id:            UUID
    exercise_id:   UUID
    exercise_name: str
    muscle_group:  str
    sets:          int
    reps:          int
    weight_kg:     float
    notes:         Optional[str]
    order_index:   int
    total_volume:  float   # sets * reps * weight_kg, не хранится в БД

    model_config = {"from_attributes": True}


class WorkoutCreate(BaseModel):
    workout_date:     date
    duration_minutes: Optional[int] = Field(None, ge=1, le=600)
    notes:            Optional[str] = None
    exercises:        List[WorkoutExerciseIn] = Field(..., min_length=1)


class WorkoutOut(BaseModel):
    id:               UUID
    user_id:          UUID
    workout_date:     date
    duration_minutes: Optional[int]
    notes:            Optional[str]
    synced:           bool
    exercises:        List[WorkoutExerciseOut]
    total_volume:     float
    created_at:       datetime
    updated_at:       datetime

    model_config = {"from_attributes": True}


class WorkoutListItem(BaseModel):
    """Лёгкий объект для списка — без exercises[]."""
    id:               UUID
    workout_date:     date
    duration_minutes: Optional[int]
    notes:            Optional[str]
    total_exercises:  int
    total_volume:     float
    created_at:       datetime

    model_config = {"from_attributes": True}


class WorkoutListResponse(BaseModel):
    items:  List[WorkoutListItem]
    total:  int
    limit:  int
    offset: int