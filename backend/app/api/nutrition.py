# app/api/nutrition.py
from collections import defaultdict
from datetime import date, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User, FoodItem, NutritionLog, UserNutritionGoals
from app.schemas.nutrition import (
    DailyNutritionOut,
    DailyTotalsOut,
    FoodItemCreate,
    FoodItemOut,
    MealSummaryOut,
    NutritionGoalsOut,
    NutritionGoalsPatch,
    NutritionLogCreate,
    NutritionLogOut,
    GOALS_FIELD_MAP,
    MEAL_TYPES,
)
from app.services.dependencies import get_current_user

router = APIRouter()

# Ordered list of meal keys used to guarantee consistent output
_MEAL_KEYS = ("breakfast", "lunch", "dinner", "snacks")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_goals(user_id: UUID, db: Session) -> UserNutritionGoals:
    goals = db.query(UserNutritionGoals).filter_by(user_id=user_id).first()
    if not goals:
        goals = UserNutritionGoals(user_id=user_id)
        db.add(goals)
        db.commit()
        db.refresh(goals)
    return goals


def _food_to_out(food: FoodItem) -> FoodItemOut:
    """Build FoodItemOut from an ORM FoodItem, mapping column names explicitly."""
    return FoodItemOut(
        id=food.id,
        name=food.name,
        brand=food.brand,
        calories_per_100g=food.calories_per100g,
        protein_per_100g=food.protein_per100g,
        carbs_per_100g=food.carbs_per100g,
        fat_per_100g=food.fat_per100g,
        is_custom=food.is_custom,
    )


def _log_to_out(log: NutritionLog) -> NutritionLogOut:
    """Build NutritionLogOut with the nested food_item object."""
    return NutritionLogOut(
        id=log.id,
        food_item=_food_to_out(log.food_item),
        meal_type=log.meal_type,
        quantity_g=log.quantity_g,
        date=log.date,
        calories=log.calories,
        protein_g=log.protein_g,
        carbs_g=log.carbs_g,
        fat_g=log.fat_g,
    )


# ── Food Search / Create ──────────────────────────────────────────────────────

@router.get("/foods", response_model=List[FoodItemOut])
def search_foods(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pattern = f"%{q.lower()}%"
    items = (
        db.query(FoodItem)
        .filter(func.lower(FoodItem.name).like(pattern))
        .filter(
            (FoodItem.is_custom == False) |
            (FoodItem.created_by == current_user.id)
        )
        .order_by(FoodItem.is_custom.asc(), FoodItem.name.asc())
        .limit(limit)
        .all()
    )
    return [_food_to_out(item) for item in items]


@router.post("/foods", response_model=FoodItemOut, status_code=201)
def create_custom_food(
    payload: FoodItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    duplicate = (
        db.query(FoodItem)
        .filter(
            FoodItem.created_by == current_user.id,
            func.lower(FoodItem.name) == payload.name.lower(),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail=f"Food '{payload.name}' already exists")

    item = FoodItem(
        name=payload.name,
        brand=payload.brand,
        calories_per100g=payload.calories_per_100g,
        protein_per100g=payload.protein_per_100g,
        carbs_per100g=payload.carbs_per_100g,
        fat_per100g=payload.fat_per_100g,
        is_custom=True,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _food_to_out(item)


# ── Logging ───────────────────────────────────────────────────────────────────

@router.post("/log", response_model=NutritionLogOut, status_code=201)
def log_food(
    payload: NutritionLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.meal_type not in MEAL_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"meal_type must be one of: {sorted(MEAL_TYPES)}",
        )

    food = db.query(FoodItem).filter_by(id=payload.food_item_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")

    factor = payload.quantity_g / 100.0
    log = NutritionLog(
        user_id=current_user.id,
        date=payload.date,
        meal_type=payload.meal_type,
        food_item_id=food.id,
        quantity_g=payload.quantity_g,
        calories=round(food.calories_per100g * factor, 2),
        protein_g=round(food.protein_per100g * factor, 2),
        carbs_g=round(food.carbs_per100g * factor, 2),
        fat_g=round(food.fat_per100g * factor, 2),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _log_to_out(log)


@router.delete("/log/{log_id}", status_code=204)
def delete_log(
    log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(NutritionLog).filter_by(id=log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found")
    if log.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your log entry")
    db.delete(log)
    db.commit()


# ── Daily / Weekly ────────────────────────────────────────────────────────────

@router.get("/daily", response_model=DailyNutritionOut)
def get_daily(
    date: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = (
        db.query(NutritionLog)
        .filter_by(user_id=current_user.id, date=date)
        .all()
    )

    # Accumulate per-meal entries and day totals
    meal_entries: dict  = defaultdict(list)
    meal_calories: dict = defaultdict(float)
    total_calories  = 0.0
    total_protein_g = 0.0
    total_carbs_g   = 0.0
    total_fat_g     = 0.0

    for log in logs:
        entry = _log_to_out(log)
        meal_entries[log.meal_type].append(entry)
        meal_calories[log.meal_type] += log.calories
        total_calories  += log.calories
        total_protein_g += log.protein_g
        total_carbs_g   += log.carbs_g
        total_fat_g     += log.fat_g

    # Guarantee all four meal keys are present
    meals = {
        meal: MealSummaryOut(
            calories=round(meal_calories[meal], 2),
            entries=meal_entries[meal],
        )
        for meal in _MEAL_KEYS
    }

    return DailyNutritionOut(
        date=date,
        calories=round(total_calories,  2),
        protein_g=round(total_protein_g, 2),
        carbs_g=round(total_carbs_g,   2),
        fat_g=round(total_fat_g,     2),
        meals=meals,
    )


@router.get("/weekly", response_model=List[DailyTotalsOut])
def get_weekly(
    from_date: date = Query(..., alias="from"),
    to_date:   date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (to_date - from_date).days > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    logs = (
        db.query(NutritionLog)
        .filter(
            NutritionLog.user_id == current_user.id,
            NutritionLog.date >= from_date,
            NutritionLog.date <= to_date,
        )
        .all()
    )

    by_date: dict = {}
    current = from_date
    while current <= to_date:
        by_date[current] = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
        current += timedelta(days=1)

    for log in logs:
        entry = by_date[log.date]
        entry["calories"]  += log.calories
        entry["protein_g"] += log.protein_g
        entry["carbs_g"]   += log.carbs_g
        entry["fat_g"]     += log.fat_g

    return [
        DailyTotalsOut(
            date=d,
            calories=round(v["calories"], 2),
            protein_g=round(v["protein_g"], 2),
            carbs_g=round(v["carbs_g"], 2),
            fat_g=round(v["fat_g"], 2),
        )
        for d, v in sorted(by_date.items())
    ]


# ── Goals ─────────────────────────────────────────────────────────────────────

@router.get("/goals", response_model=NutritionGoalsOut)
def get_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create_goals(current_user.id, db)


@router.patch("/goals", response_model=NutritionGoalsOut)
def patch_goals(
    payload: NutritionGoalsPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = _get_or_create_goals(current_user.id, db)

    # Map frontend field names (calories, protein_g, …) → DB column names
    for field, value in payload.model_dump(exclude_none=True).items():
        db_column = GOALS_FIELD_MAP[field]
        setattr(goals, db_column, value)

    db.commit()
    db.refresh(goals)
    return goals
