from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime, date


class SetEntry(BaseModel):
    set_number: int   = Field(..., ge=1)
    reps:       int   = Field(..., ge=1, le=1000)
    weight_kg:  float = Field(..., ge=0.0)


class WorkoutExerciseIn(BaseModel):
    exercise_id: UUID
    # New per-set format
    sets_data:   Optional[List[SetEntry]] = None
    # Legacy flat format (backward compat — converted to sets_data)
    sets:        Optional[int]   = Field(None, ge=1, le=100)
    reps:        Optional[int]   = Field(None, ge=1, le=1000)
    weight_kg:   Optional[float] = Field(None, ge=0.0)
    notes:       Optional[str]   = None
    order_index: int             = Field(default=0, ge=0)

    @model_validator(mode="after")
    def normalise_sets_data(self) -> "WorkoutExerciseIn":
        """Ensure sets_data is always populated."""
        if self.sets_data:
            return self
        # Convert legacy flat format
        sets    = self.sets    or 1
        reps    = self.reps    or 1
        weight  = self.weight_kg or 0.0
        self.sets_data = [
            SetEntry(set_number=i + 1, reps=reps, weight_kg=weight)
            for i in range(sets)
        ]
        return self


class WorkoutExerciseOut(BaseModel):
    id:            UUID
    exercise_id:   UUID
    exercise_name: str
    muscle_group:  str
    sets:          int
    reps:          int
    weight_kg:     float
    sets_data:     Optional[List[SetEntry]] = None
    notes:         Optional[str]
    order_index:   int
    total_volume:  float

    model_config = {"from_attributes": True}


class WorkoutCreate(BaseModel):
    workout_date:     date
    duration_minutes: Optional[int] = Field(None, ge=1, le=600)
    notes:            Optional[str] = None
    exercises:        List[WorkoutExerciseIn] = Field(..., min_length=1)

    @field_validator("workout_date")
    @classmethod
    def no_future_dates(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Workout date cannot be in the future")
        return v


class AchievementEarned(BaseModel):
    id:          UUID
    name:        str
    description: str
    icon_key:    str

    model_config = {"from_attributes": True}


class PROut(BaseModel):
    exercise_id:   UUID
    exercise_name: str
    new_weight:    float   # new best weight_kg
    prev_weight:   float   # previous best weight_kg
    delta:         float   # improvement in kg


class WorkoutOut(BaseModel):
    id:               UUID
    user_id:          UUID
    workout_date:     date
    duration_minutes: Optional[int]
    notes:            Optional[str]
    synced:           bool
    exercises:        List[WorkoutExerciseOut]
    total_volume:     float
    xp_gained:        Optional[int] = None
    new_level:        Optional[int] = None
    leveled_up:       bool = False
    achievements:     List[AchievementEarned] = []
    new_prs:          List[PROut] = []
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