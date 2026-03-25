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
    MacroTotals,
    NutritionGoalsOut,
    NutritionGoalsPatch,
    NutritionLogCreate,
    NutritionLogOut,
    MEAL_TYPES,
)
from app.services.dependencies import get_current_user

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_goals(user_id: UUID, db: Session) -> UserNutritionGoals:
    goals = db.query(UserNutritionGoals).filter_by(user_id=user_id).first()
    if not goals:
        goals = UserNutritionGoals(user_id=user_id)
        db.add(goals)
        db.commit()
        db.refresh(goals)
    return goals


def _log_to_out(log: NutritionLog) -> NutritionLogOut:
    return NutritionLogOut(
        id=log.id,
        food_name=log.food_item.name,
        meal_type=log.meal_type,
        quantity_g=log.quantity_g,
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
    return (
        db.query(FoodItem)
        .filter(
            func.lower(FoodItem.name).like(pattern),
        )
        .filter(
            (FoodItem.is_custom == False) |
            (FoodItem.created_by == current_user.id)
        )
        .order_by(
            FoodItem.is_custom.asc(),   # system foods first (False < True)
            FoodItem.name.asc(),
        )
        .limit(limit)
        .all()
    )


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
        calories_per100g=payload.calories_per100g,
        protein_per100g=payload.protein_per100g,
        carbs_per100g=payload.carbs_per100g,
        fat_per100g=payload.fat_per100g,
        is_custom=True,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


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

    meals: dict = defaultdict(list)
    totals = MacroTotals(calories=0, protein_g=0, carbs_g=0, fat_g=0)

    for log in logs:
        meals[log.meal_type].append(_log_to_out(log))
        totals.calories  += log.calories
        totals.protein_g += log.protein_g
        totals.carbs_g   += log.carbs_g
        totals.fat_g     += log.fat_g

    totals.calories  = round(totals.calories,  2)
    totals.protein_g = round(totals.protein_g, 2)
    totals.carbs_g   = round(totals.carbs_g,   2)
    totals.fat_g     = round(totals.fat_g,     2)

    goals = _get_or_create_goals(current_user.id, db)

    # Ensure all meal keys present
    for meal in ("breakfast", "lunch", "dinner", "snack"):
        if meal not in meals:
            meals[meal] = []

    return DailyNutritionOut(
        date=date,
        goals=NutritionGoalsOut.model_validate(goals),
        totals=totals,
        meals=dict(meals),
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

    # Aggregate by date
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

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(goals, field, value)

    db.commit()
    db.refresh(goals)
    return goals
