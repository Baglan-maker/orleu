from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
import math

from app.db.database import get_db
from app.models import User, Workout, ExerciseLibrary, UserProgress, UserMission, Achievement, UserAchievement, Campaign, CampaignChapter
from app.models.workout import WorkoutExercise
from app.schemas.workout import (
    WorkoutCreate, WorkoutOut, WorkoutExerciseOut,
    WorkoutListItem, WorkoutListResponse, AchievementEarned,
)
from app.services.dependencies import get_current_user

router = APIRouter()


# ── Campaign constants ─────────────────────────────────────────────────────────
SESSIONS_PER_CHAPTER = 2   # chapters unlock every 2 completed sessions

# ── XP / leveling constants ────────────────────────────────────────────────────
BASE_XP_PER_WORKOUT = 50
XP_PER_EXERCISE     = 10
XP_PER_1000KG_VOL   = 15
XP_FOR_LEVEL        = lambda lvl: int(100 * (1.15 ** (lvl - 1)))


def _award_xp_and_streak(db: Session, user_id: UUID, exercises: list[WorkoutExercise]):
    """Award XP, update streak, check level-up after a workout."""
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        return None

    # Calculate XP
    total_volume = sum(e.sets * e.reps * e.weight_kg for e in exercises)
    xp_gained = (
        BASE_XP_PER_WORKOUT
        + len(exercises) * XP_PER_EXERCISE
        + int(total_volume / 1000) * XP_PER_1000KG_VOL
    )

    # Update streak — doc: increment if last workout was yesterday or today, reset otherwise
    now = datetime.now(timezone.utc)
    if progress.last_workout_at:
        days_gap = (now.date() - progress.last_workout_at.date()).days
        if days_gap == 0:
            pass  # same day — streak unchanged
        elif days_gap == 1:
            progress.current_streak += 1  # consecutive day
        else:
            progress.current_streak = 1  # gap > 1 day — reset
    else:
        progress.current_streak = 1

    progress.longest_streak = max(progress.longest_streak, progress.current_streak)
    progress.last_workout_at = now

    # Award XP and check level-up
    old_level = progress.level
    progress.xp += xp_gained
    progress.coins += 10  # base coins per workout

    # Recalculate level
    xp_remaining = progress.xp
    new_level = 1
    while xp_remaining >= XP_FOR_LEVEL(new_level):
        xp_remaining -= XP_FOR_LEVEL(new_level)
        new_level += 1
    progress.level = new_level

    leveled_up = new_level > old_level

    # Auto-progress active missions
    _progress_missions(db, user_id, exercises, total_volume)

    return {"xp_gained": xp_gained, "new_level": new_level, "leveled_up": leveled_up}


def _progress_missions(db: Session, user_id: UUID, exercises: list, total_volume: float):
    """Update active user missions based on the completed workout."""
    now = datetime.now(timezone.utc)
    active_missions = (
        db.query(UserMission)
        .filter(
            UserMission.user_id == user_id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .all()
    )

    for um in active_missions:
        tmpl = um.template
        if not tmpl:
            continue

        delta = 0.0
        if tmpl.type == "workout_count":
            delta = 1
        elif tmpl.type == "total_reps":
            delta = sum(e.sets * e.reps for e in exercises)
        elif tmpl.type == "total_volume":
            delta = total_volume
        elif tmpl.type == "unique_exercises":
            delta = len(set(str(e.exercise_id) for e in exercises))
        elif tmpl.type == "muscle_sets":
            # Count sets across all exercises (simplified — all muscle groups)
            delta = sum(e.sets for e in exercises)

        um.current_progress += delta
        if um.current_progress >= um.adjusted_target and um.status == "active":
            um.status = "completed"
            um.completed_at = now
            # Award mission XP and coins
            progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
            if progress:
                um.xp_awarded = tmpl.base_xp
                um.coins_awarded = tmpl.base_coins
                progress.xp += tmpl.base_xp
                progress.coins += tmpl.base_coins


def _check_achievements(db: Session, user_id: UUID) -> list[Achievement]:
    """Check all achievements against user stats, award any newly earned ones."""
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        return []

    # Already earned achievement IDs
    earned_ids = {
        row.achievement_id
        for row in db.query(UserAchievement.achievement_id)
        .filter(UserAchievement.user_id == user_id)
        .all()
    }

    # Precompute stats used by condition_type
    total_sessions = db.query(Workout).filter(Workout.user_id == user_id).count()
    missions_completed = (
        db.query(UserMission)
        .filter(UserMission.user_id == user_id, UserMission.status == "completed")
        .count()
    )

    stats = {
        "streak_days":        progress.current_streak,
        "total_sessions":     total_sessions,
        "missions_completed": missions_completed,
        # pr_count requires comparing exercise weights — simplified: count workouts with new max
        "pr_count":           0,  # TODO: implement PR tracking if needed
    }

    all_achievements = db.query(Achievement).all()
    newly_earned: list[Achievement] = []

    for ach in all_achievements:
        if ach.id in earned_ids:
            continue
        user_value = stats.get(ach.condition_type, 0)
        if user_value >= ach.condition_value:
            db.add(UserAchievement(user_id=user_id, achievement_id=ach.id))
            newly_earned.append(ach)

    return newly_earned


def _advance_campaign_chapter(db: Session, user_id: UUID):
    """Auto-assign campaign and advance chapter based on total sessions."""
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        return

    # Assign first active campaign if user has none
    if not progress.current_campaign_id:
        first = (
            db.query(Campaign)
            .filter(Campaign.is_active == True)
            .order_by(Campaign.order_index)
            .first()
        )
        if not first:
            return
        progress.current_campaign_id = first.id

    chapters = (
        db.query(CampaignChapter)
        .filter(CampaignChapter.campaign_id == progress.current_campaign_id)
        .order_by(CampaignChapter.chapter_number)
        .all()
    )
    if not chapters:
        return

    total_sessions = db.query(Workout).filter(Workout.user_id == user_id).count()
    chapter_idx = min((total_sessions - 1) // SESSIONS_PER_CHAPTER, len(chapters) - 1)
    target = chapters[chapter_idx]

    if progress.current_chapter_id is None:
        progress.current_chapter_id = target.id
    else:
        current = next((c for c in chapters if c.id == progress.current_chapter_id), None)
        if current is None or target.chapter_number > current.chapter_number:
            progress.current_chapter_id = target.id


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


def _to_workout_out(
    workout: Workout,
    gamification: dict | None = None,
) -> WorkoutOut:
    ex_out = [_to_exercise_out(we) for we in workout.exercises]
    gam = gamification or {}
    return WorkoutOut(
        id=workout.id,
        user_id=workout.user_id,
        workout_date=workout.workout_date,
        duration_minutes=workout.duration_minutes,
        notes=workout.notes,
        synced=workout.synced,
        exercises=ex_out,
        total_volume=round(sum(e.total_volume for e in ex_out), 2),
        xp_gained=gam.get("xp_gained"),
        new_level=gam.get("new_level"),
        leveled_up=gam.get("leveled_up", False),
        achievements=gam.get("achievements", []),
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

    db.flush()

    # Award XP, update streak, progress missions
    workout_exercises = (
        db.query(WorkoutExercise)
        .filter(WorkoutExercise.workout_id == workout.id)
        .all()
    )
    reward = _award_xp_and_streak(db, current_user.id, workout_exercises)

    # Check achievements after all stats are updated
    newly_earned = _check_achievements(db, current_user.id)

    # Auto-advance campaign chapter
    _advance_campaign_chapter(db, current_user.id)

    db.commit()
    workout.exercises = _load_with_exercises(db, workout.id)
    db.refresh(workout)

    gamification = {
        **(reward or {}),
        "achievements": [
            AchievementEarned(
                id=a.id, name=a.name,
                description=a.description, icon_key=a.icon_key,
            )
            for a in newly_earned
        ],
    }
    return _to_workout_out(workout, gamification=gamification)


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