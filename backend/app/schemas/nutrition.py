from datetime import date
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

# "snacks" — keep in sync with NutritionLog.meal_type column
MEAL_TYPES = {"breakfast", "lunch", "dinner", "snacks"}


# ── Food Items ────────────────────────────────────────────────────────────────

class FoodItemOut(BaseModel):
    """
    Serialised food item returned to the client.
    Uses validation_alias so Pydantic can read the ORM column names
    (calories_per100g) while the JSON key uses underscores (calories_per_100g).
    populate_by_name=True lets us also construct directly with the Python field
    names when building the object manually (e.g. in _log_to_out).
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id:               UUID
    name:             str
    brand:            Optional[str] = None
    calories_per_100g: float = Field(validation_alias="calories_per100g")
    protein_per_100g:  float = Field(validation_alias="protein_per100g")
    carbs_per_100g:    float = Field(validation_alias="carbs_per100g")
    fat_per_100g:      float = Field(validation_alias="fat_per100g")
    is_custom:         bool


class FoodItemCreate(BaseModel):
    """Request body for POST /api/nutrition/foods (frontend uses _100g names)."""
    name:             str   = Field(..., min_length=1, max_length=200)
    brand:            Optional[str] = Field(None, max_length=100)
    calories_per_100g: float = Field(..., ge=0)
    protein_per_100g:  float = Field(..., ge=0)
    carbs_per_100g:    float = Field(..., ge=0)
    fat_per_100g:      float = Field(..., ge=0)


# ── Nutrition Logs ────────────────────────────────────────────────────────────

class NutritionLogCreate(BaseModel):
    date:         date
    meal_type:    str
    food_item_id: UUID
    quantity_g:   float = Field(..., gt=0)


class NutritionLogOut(BaseModel):
    """A single logged food entry, with the full food_item nested."""
    id:         UUID
    food_item:  FoodItemOut
    meal_type:  str
    quantity_g: float
    date:       date
    calories:   float
    protein_g:  float
    carbs_g:    float
    fat_g:      float


# ── Meals / Daily ─────────────────────────────────────────────────────────────

class MealSummaryOut(BaseModel):
    """Per-meal totals + entries for the daily view."""
    calories: float
    entries:  List[NutritionLogOut]


class DailyNutritionOut(BaseModel):
    """
    Response for GET /api/nutrition/daily.
    Totals are at the top level; meals is a dict keyed by meal type.
    Goals are loaded separately via GET /api/nutrition/goals.
    """
    date:      date
    calories:  float
    protein_g: float
    carbs_g:   float
    fat_g:     float
    meals:     Dict[str, MealSummaryOut]


class DailyTotalsOut(BaseModel):
    date:      date
    calories:  float
    protein_g: float
    carbs_g:   float
    fat_g:     float


# ── Buff ──────────────────────────────────────────────────────────────────────

class NutritionBuffClaim(BaseModel):
    """Response for POST /api/nutrition/claim-buff."""
    granted:        bool
    valid_for_date: Optional[date] = None
    reason:         Optional[str]  = None  # populated only when not granted


# ── Goals ─────────────────────────────────────────────────────────────────────

class NutritionGoalsOut(BaseModel):
    """
    Goals serialised for the client.
    validation_alias maps DB column names → client-friendly names.
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    calories:  int = Field(validation_alias="calories_goal")
    protein_g: int = Field(validation_alias="protein_goal_g")
    carbs_g:   int = Field(validation_alias="carbs_goal_g")
    fat_g:     int = Field(validation_alias="fat_goal_g")


class NutritionGoalsPatch(BaseModel):
    """PATCH body — frontend sends calories/protein_g/carbs_g/fat_g."""
    calories:  Optional[int] = Field(None, gt=0)
    protein_g: Optional[int] = Field(None, gt=0)
    carbs_g:   Optional[int] = Field(None, gt=0)
    fat_g:     Optional[int] = Field(None, gt=0)


# Map from NutritionGoalsPatch field names → UserNutritionGoals column names
GOALS_FIELD_MAP: Dict[str, str] = {
    "calories":  "calories_goal",
    "protein_g": "protein_goal_g",
    "carbs_g":   "carbs_goal_g",
    "fat_g":     "fat_goal_g",
}


# ── Recent Foods ───────────────────────────────────────────────────────────────

class RecentFoodItemOut(BaseModel):
    """Most-recently-used unique food items for the current user."""
    food_item_id:      UUID
    name:              str
    brand:             Optional[str] = None
    calories_per_100g: float
    protein_per_100g:  float
    carbs_per_100g:    float
    fat_per_100g:      float
    last_used_date:    date
    typical_quantity_g: float
