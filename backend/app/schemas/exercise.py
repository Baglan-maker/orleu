from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "legs", "core", "full_body"]
CATEGORIES    = ["compound", "isolation", "cardio", "bodyweight"]


class ExerciseCreate(BaseModel):
    name:         str           = Field(..., min_length=1, max_length=100)
    muscle_group: str
    category:     str           = "isolation"
    alias:        Optional[str] = None


class ExerciseOut(BaseModel):
    id:           UUID
    name:         str
    alias:        Optional[str]
    muscle_group: str
    category:     str
    is_custom:    bool
    created_by:   Optional[UUID]
    created_at:   datetime

    model_config = {"from_attributes": True}