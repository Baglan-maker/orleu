# app/schemas/nutrition.py
from datetime import date
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack"}


# ── Food Items ────────────────────────────────────────────────────────────────

class FoodItemOut(BaseModel):
    id:               UUID
    name:             str
    brand:            Optional[str]
    calories_per100g: float
    protein_per100g:  float
    carbs_per100g:    float
    fat_per100g:      float
    is_custom:        bool

    class Config:
        from_attributes = True


class FoodItemCreate(BaseModel):
    name:             str = Field(..., min_length=1, max_length=200)
    brand:            Optional[str] = Field(None, max_length=100)
    calories_per100g: float = Field(..., ge=0)
    protein_per100g:  float = Field(..., ge=0)
    carbs_per100g:    float = Field(..., ge=0)
    fat_per100g:      float = Field(..., ge=0)


# ── Nutrition Logs ────────────────────────────────────────────────────────────

class NutritionLogCreate(BaseModel):
    date:         date
    meal_type:    str
    food_item_id: UUID
    quantity_g:   float = Field(..., gt=0)


class NutritionLogOut(BaseModel):
    id:         UUID
    food_name:  str
    meal_type:  str
    quantity_g: float
    calories:   float
    protein_g:  float
    carbs_g:    float
    fat_g:      float

    class Config:
        from_attributes = True


# ── Goals ─────────────────────────────────────────────────────────────────────

class NutritionGoalsOut(BaseModel):
    calories_goal:  int
    protein_goal_g: int
    carbs_goal_g:   int
    fat_goal_g:     int

    class Config:
        from_attributes = True


class NutritionGoalsPatch(BaseModel):
    calories_goal:  Optional[int] = Field(None, gt=0)
    protein_goal_g: Optional[int] = Field(None, gt=0)
    carbs_goal_g:   Optional[int] = Field(None, gt=0)
    fat_goal_g:     Optional[int] = Field(None, gt=0)


# ── Daily / Weekly ────────────────────────────────────────────────────────────

class MacroTotals(BaseModel):
    calories:  float
    protein_g: float
    carbs_g:   float
    fat_g:     float


class DailyNutritionOut(BaseModel):
    date:   date
    goals:  NutritionGoalsOut
    totals: MacroTotals
    meals:  Dict[str, List[NutritionLogOut]]


class DailyTotalsOut(BaseModel):
    date:      date
    calories:  float
    protein_g: float
    carbs_g:   float
    fat_g:     float
