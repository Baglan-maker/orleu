import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models import User, Workout, ExerciseLibrary, UserProgress, UserMission, Achievement
from app.models.workout import WorkoutExercise
from app.schemas.workout import (
    WorkoutCreate, WorkoutOut, WorkoutExerciseOut, SetEntry,
    WorkoutListItem, WorkoutListResponse, AchievementEarned, PROut,
)
from app.services.dependencies import get_current_user
from app.services.gamification_service import try_advance_chapter, check_and_award_achievements, check_and_update_prs

router = APIRouter()


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

    # Calculate XP — use sets_data when available for accurate volume
    def _exercise_volume(e: WorkoutExercise) -> float:
        if e.sets_data:
            rows = json.loads(e.sets_data)
            return sum(r["reps"] * r["weight_kg"] for r in rows)
        return e.sets * e.reps * e.weight_kg

    total_volume = sum(_exercise_volume(e) for e in exercises)
    xp_gained = (
        BASE_XP_PER_WORKOUT
        + len(exercises) * XP_PER_EXERCISE
        + int(total_volume / 1000) * XP_PER_1000KG_VOL
    )

    # Update streak — grace period: streak survives up to 2 rest days, resets on 3+
    now = datetime.now(timezone.utc)
    if progress.last_workout_at:
        days_gap = (now.date() - progress.last_workout_at.date()).days
        if days_gap == 0:
            pass  # same day — streak unchanged
        elif days_gap <= 2:
            progress.current_streak += 1  # within grace period — keep streak
        else:
            progress.current_streak = 1  # gap >= 3 days — reset
    else:
        progress.current_streak = 1

    progress.longest_streak  = max(progress.longest_streak or 0, progress.current_streak)
    # Store as midnight UTC for consistent date-gap calculations
    progress.last_workout_at = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
    progress.total_workouts  = (progress.total_workouts or 0) + 1

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


# Doc §5 category mapping: internal type → doc category name
MISSION_TYPE_CATEGORY: dict[str, str] = {
    "total_reps":       "volume",
    "total_volume":     "volume",
    "workout_count":    "consistency",
    "muscle_sets":      "intensity",
    "unique_exercises": "variety",
}


_MUSCLE_GROUP_KEYWORDS: list[tuple[str, str]] = [
    ("chest", "chest"),
    ("back", "back"),
    ("shoulder", "shoulders"),
    ("arm", "arms"),
    ("leg", "legs"),
    ("core", "core"),
    ("full body", "full_body"),
]


def _extract_muscle_group(description_template: str) -> str | None:
    """Extract target muscle group from description like 'Complete {target} chest sets this week'."""
    lower = description_template.lower()
    for keyword, group in _MUSCLE_GROUP_KEYWORDS:
        if keyword in lower:
            return group
    return None


def _sets_data_reps(e: WorkoutExercise) -> int:
    """Total reps across all sets, using sets_data when available."""
    if e.sets_data:
        rows = json.loads(e.sets_data)
        return sum(r["reps"] for r in rows)
    return e.sets * e.reps


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
            delta = sum(_sets_data_reps(e) for e in exercises)
        elif tmpl.type == "total_volume":
            delta = total_volume
        elif tmpl.type == "unique_exercises":
            delta = len(set(str(e.exercise_id) for e in exercises))
        elif tmpl.type == "muscle_sets":
            # Extract target muscle from description_template, e.g. "Complete {target} chest sets this week"
            target_muscle = _extract_muscle_group(tmpl.description_template)
            if target_muscle:
                delta = sum(
                    e.sets for e in exercises
                    if e.exercise and e.exercise.muscle_group
                    and e.exercise.muscle_group.lower() == target_muscle
                )
            else:
                delta = sum(e.sets for e in exercises)

        um.current_progress += delta
        if um.current_progress >= um.adjusted_target and um.status == "active":
            um.status = "completed"
            um.completed_at = now
            # Award mission XP and coins, then recalculate level
            progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
            if progress:
                um.xp_awarded    = tmpl.base_xp
                um.coins_awarded = tmpl.base_coins
                progress.xp += tmpl.base_xp
                progress.coins += tmpl.base_coins
                progress.missions_completed_count = (progress.missions_completed_count or 0) + 1
                # Recalculate level after mission XP
                xp_remaining = progress.xp
                new_level = 1
                while xp_remaining >= XP_FOR_LEVEL(new_level):
                    xp_remaining -= XP_FOR_LEVEL(new_level)
                    new_level += 1
                progress.level = new_level




# ── helpers ───────────────────────────────────────────────────────────────────

def _parse_sets_data(we: WorkoutExercise) -> list[SetEntry] | None:
    if not we.sets_data:
        return None
    rows = json.loads(we.sets_data)
    return [SetEntry(**r) for r in rows]


def _exercise_total_volume(we: WorkoutExercise) -> float:
    if we.sets_data:
        rows = json.loads(we.sets_data)
        return round(sum(r["reps"] * r["weight_kg"] for r in rows), 2)
    return round(we.sets * we.reps * we.weight_kg, 2)


def _to_exercise_out(we: WorkoutExercise) -> WorkoutExerciseOut:
    return WorkoutExerciseOut(
        id=we.id,
        exercise_id=we.exercise_id,
        exercise_name=we.exercise.name if we.exercise else "Unknown",
        muscle_group=we.exercise.muscle_group if we.exercise else "",
        sets=we.sets,
        reps=we.reps,
        weight_kg=we.weight_kg,
        sets_data=_parse_sets_data(we),
        notes=we.notes,
        order_index=we.order_index,
        total_volume=_exercise_total_volume(we),
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
        new_prs=gam.get("new_prs", []),
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
        sd = item.sets_data or []
        computed_sets     = len(sd)
        computed_reps     = max((s.reps for s in sd), default=1)
        computed_weight   = max((s.weight_kg for s in sd), default=0.0)
        sets_data_json    = json.dumps([s.model_dump() for s in sd]) if sd else None
        db.add(WorkoutExercise(
            workout_id=workout.id,
            exercise_id=item.exercise_id,
            sets=computed_sets,
            reps=computed_reps,
            weight_kg=computed_weight,
            sets_data=sets_data_json,
            notes=item.notes,
            order_index=item.order_index,
        ))

    db.flush()

    # Award XP, update streak, progress missions
    workout_exercises = (
        db.query(WorkoutExercise)
        .options(joinedload(WorkoutExercise.exercise))
        .filter(WorkoutExercise.workout_id == workout.id)
        .all()
    )
    reward = _award_xp_and_streak(db, current_user.id, workout_exercises)
    db.flush()

    # Check and update personal records
    pr_results = check_and_update_prs(current_user.id, workout_exercises, db)

    # Check achievements after all stats are updated
    newly_earned = check_and_award_achievements(current_user.id, db)

    db.commit()
    workout.exercises = _load_with_exercises(db, workout.id)
    db.refresh(workout)

    # Re-fetch progress so SQLAlchemy identity map is cleared before chapter check
    db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()
    # Advance campaign chapter (separate commit inside try_advance_chapter)
    try_advance_chapter(current_user.id, db)

    gamification = {
        **(reward or {}),
        "achievements": [
            AchievementEarned(
                id=a.id, name=a.name,
                description=a.description, icon_key=a.icon_key,
            )
            for a in newly_earned
        ],
        "new_prs": [
            PROut(
                exercise_id=pr.exercise_id,
                exercise_name=pr.exercise_name,
                new_weight=pr.new_weight,
                prev_weight=pr.prev_weight,
                delta=pr.delta,
            )
            for pr in pr_results
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
        vol = sum(_exercise_total_volume(e) for e in exercises)
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
    exercises = _load_with_exercises(db, workout_id)

    # Reverse gamification side effects
    progress = db.query(UserProgress).filter(UserProgress.user_id == current_user.id).first()
    if progress:
        # 1. Reverse XP from this workout
        total_volume = sum(_exercise_total_volume(e) for e in exercises)
        xp_to_remove = (
            BASE_XP_PER_WORKOUT
            + len(exercises) * XP_PER_EXERCISE
            + int(total_volume / 1000) * XP_PER_1000KG_VOL
        )
        progress.xp = max(0, (progress.xp or 0) - xp_to_remove)
        progress.coins = max(0, (progress.coins or 0) - 10)  # reverse base coins

        # 2. Recalculate level from new XP
        xp_remaining = progress.xp
        new_level = 1
        while xp_remaining >= XP_FOR_LEVEL(new_level):
            xp_remaining -= XP_FOR_LEVEL(new_level)
            new_level += 1
        progress.level = new_level

        # 3. Decrement total_workouts
        progress.total_workouts = max(0, (progress.total_workouts or 0) - 1)

        # 4. Recalculate streak from remaining workouts
        remaining_workouts = (
            db.query(Workout)
            .filter(Workout.user_id == current_user.id, Workout.id != workout_id)
            .order_by(Workout.workout_date.desc())
            .all()
        )
        if remaining_workouts:
            progress.last_workout_at = datetime.combine(
                remaining_workouts[0].workout_date,
                datetime.min.time(),
                tzinfo=timezone.utc,
            )
            # Recalculate current streak from most recent workout backward
            # Grace period: gap <= 2 days keeps the streak alive
            streak = 1
            for i in range(len(remaining_workouts) - 1):
                gap = (remaining_workouts[i].workout_date - remaining_workouts[i + 1].workout_date).days
                if 0 < gap <= 2:
                    streak += 1
                elif gap == 0:
                    continue  # same day — don't count twice
                else:
                    break  # gap >= 3 days — streak broken
            progress.current_streak = streak

            # Recalculate longest_streak from full workout history
            max_streak = 1
            run = 1
            for i in range(len(remaining_workouts) - 1):
                gap = (remaining_workouts[i].workout_date - remaining_workouts[i + 1].workout_date).days
                if 0 < gap <= 2:
                    run += 1
                    max_streak = max(max_streak, run)
                elif gap == 0:
                    continue
                else:
                    run = 1
            progress.longest_streak = max_streak
        else:
            progress.last_workout_at = None
            progress.current_streak = 0
            progress.longest_streak = 0

    db.delete(workout)
    db.commit()