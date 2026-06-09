from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
import random
from datetime import datetime, timezone, timedelta

from sqlalchemy import func

from app.db.database import get_db
from app.models import (
    User, UserProgress, MissionTemplate, UserMission,
    Workout, WorkoutExercise, ExerciseLibrary,
)
from app.models.ml import MlPrediction
from app.schemas.gamification import (
    MissionTemplateOut,
    UserMissionOut,
    AvailableMissionsOut,
)
from app.services.dependencies import get_current_user
from app.api.workouts import MISSION_TYPE_CATEGORY, _extract_muscle_group

router = APIRouter()

# Reroll config — once per 7 days, fixed coin cost.
# Kept here (not in DB) because tuning shouldn't require a migration; bump if
# economy changes. The cost intentionally stings a little so reroll feels like
# a real choice, not a free re-spin until you like the offer.
REROLL_COST_COINS = 30
REROLL_COOLDOWN_DAYS = 7

# ── Adaptive mission target model (personal baseline + visible trend band) ──
#
#   target = baseline × template_ratio × trend_factor   (then clamped + rounded)
#
#   baseline       = the user's OWN recent weekly figure for this mission type
#                    (their average reps/volume/sessions per week). Users without
#                    enough recent history fall back to a cold-start prior.
#   template_ratio = base_target / TYPE_REFERENCE — how hard THIS template is
#                    relative to a "normal" mission of its type (keeps Comeback
#                    easy and Crusher hard regardless of personalisation).
#   trend_factor   = the visible, deterministic ML adaptation (see TREND_FACTOR).

# "Normal" weekly value per mission type. Used to (a) derive each template's
# relative difficulty and (b) seed the cold-start baseline.
TYPE_REFERENCE: dict[str, float] = {
    "total_reps":       350.0,
    "total_volume":     5000.0,
    "workout_count":    4.0,
    "muscle_sets":      16.0,
    "unique_exercises": 8.0,
}

# Cold-start only: gentle nudge by self-reported experience when the user has no
# usable history yet. Deliberately mild (never the old 2.5×) so count-based
# missions stay sane.
EXPERIENCE_FACTOR: dict[str, float] = {
    "beginner":     1.0,
    "intermediate": 1.25,
    "advanced":     1.5,
}

# The adaptive layer: fixed, explainable multipliers driven by the nightly ML
# trend. No randomness — the user can be told the exact change.
TREND_FACTOR: dict[str, float] = {
    "improving": 1.15,   # +15% — push while progressing
    "plateau":   1.00,   #   0% — hold; plateau-breaker mission TYPES add novelty
    "declining": 0.80,   # −20% — ease off to re-engage
}

# Short, user-facing chip text explaining what the ML changed and why.
_TREND_NOTE: dict[str, str] = {
    "improving": "Tuned +15% - you're improving",
    "plateau":   "Held steady - plateau detected",
    "declining": "Eased -20% - recovery week",
}

# Sanity bounds + rounding step per type so no target is ever absurd. (min, max, step)
TYPE_BOUNDS: dict[str, tuple[float, float, int]] = {
    "total_reps":       (50,  1500,  10),
    "total_volume":     (500, 80000, 100),
    "workout_count":    (1,   6,     1),
    "muscle_sets":      (4,   35,    1),
    "unique_exercises": (3,   20,    1),
}

# Min workouts in the last 14 days before we trust a personal baseline.
MIN_WORKOUTS_FOR_PERSONAL = 3

# Mission type affinity per primary_goal.
# Lower rank = shown first in the available list.
# Gives each goal a clear "personality" in mission selection without hiding missions.
GOAL_TYPE_PRIORITY: dict[str, dict[str, int]] = {
    "strength": {
        "muscle_sets":      0,
        "total_volume":     1,
        "total_reps":       2,
        "workout_count":    3,
        "unique_exercises": 4,
    },
    "hypertrophy": {
        "total_reps":       0,
        "muscle_sets":      1,
        "total_volume":     2,
        "workout_count":    3,
        "unique_exercises": 4,
    },
    "endurance": {
        "workout_count":    0,
        "unique_exercises": 1,
        "total_reps":       2,
        "total_volume":     3,
        "muscle_sets":      4,
    },
}


def _reroll_status(progress: UserProgress | None, now: datetime) -> tuple[bool, datetime | None]:
    """Return (available, next_available_at)."""
    if progress is None or progress.last_mission_reroll_at is None:
        return True, None
    next_at = progress.last_mission_reroll_at + timedelta(days=REROLL_COOLDOWN_DAYS)
    if now >= next_at:
        return True, None
    return False, next_at


def _latest_trend(user_id: UUID, db: Session) -> str | None:
    """Most recent nightly ML trend for the user, or None if never predicted."""
    pred = (
        db.query(MlPrediction)
        .filter(MlPrediction.user_id == user_id)
        .order_by(MlPrediction.prediction_date.desc())
        .first()
    )
    return pred.trend if pred else None


def _has_recent_history(user_id: UUID, db: Session) -> bool:
    """True if the user logged enough workouts in the last 14 days to trust a personal baseline."""
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=14)
    count = (
        db.query(func.count(Workout.id))
        .filter(Workout.user_id == user_id, Workout.workout_date >= cutoff)
        .scalar()
    ) or 0
    return count >= MIN_WORKOUTS_FOR_PERSONAL


def _personal_weekly(user_id: UUID, template: MissionTemplate, db: Session) -> float | None:
    """The user's own recent weekly figure for this mission type, in native units.

    Magnitude/count types average the last 14 days into a per-week number; unique
    exercises use the most recent 7-day window. Returns None if no usable data.
    """
    today     = datetime.now(timezone.utc).date()
    win_start = today - timedelta(days=14)
    t = template.type

    if t == "workout_count":
        days = (
            db.query(func.count(func.distinct(Workout.workout_date)))
            .filter(Workout.user_id == user_id, Workout.workout_date >= win_start)
            .scalar()
        ) or 0
        return days / 2.0

    if t == "unique_exercises":
        wk_start = today - timedelta(days=7)
        n = (
            db.query(func.count(func.distinct(WorkoutExercise.exercise_id)))
            .join(Workout, Workout.id == WorkoutExercise.workout_id)
            .filter(Workout.user_id == user_id, Workout.workout_date >= wk_start)
            .scalar()
        ) or 0
        return float(n)

    if t == "muscle_sets":
        muscle = _extract_muscle_group(template.description_template)
        q = (
            db.query(WorkoutExercise.sets)
            .join(Workout, Workout.id == WorkoutExercise.workout_id)
            .join(ExerciseLibrary, ExerciseLibrary.id == WorkoutExercise.exercise_id)
            .filter(Workout.user_id == user_id, Workout.workout_date >= win_start)
        )
        if muscle:
            q = q.filter(func.lower(ExerciseLibrary.muscle_group) == muscle)
        return sum(r.sets for r in q.all()) / 2.0

    rows = (
        db.query(WorkoutExercise.sets, WorkoutExercise.reps, WorkoutExercise.weight_kg)
        .join(Workout, Workout.id == WorkoutExercise.workout_id)
        .filter(Workout.user_id == user_id, Workout.workout_date >= win_start)
        .all()
    )
    if t == "total_reps":
        return sum(r.sets * r.reps for r in rows) / 2.0
    if t == "total_volume":
        return sum(r.sets * r.reps * (r.weight_kg or 0.0) for r in rows) / 2.0
    return None


def _round_to(value: float, step: int) -> int:
    """Round to a friendly whole number for the mission target."""
    if step <= 1:
        return int(round(value))
    return int(round(value / step) * step)


def _compute_target(
    user: User,
    template: MissionTemplate,
    db: Session,
    trend: str | None,
    has_history: bool,
) -> tuple[float, float, bool]:
    """target = baseline × template_ratio × trend_factor, clamped + rounded.

    Returns (target, baseline_used, personalized).
    """
    t = template.type
    lo, hi, step = TYPE_BOUNDS.get(t, (1, 100000, 1))
    ref   = TYPE_REFERENCE.get(t) or (template.base_target or 1.0)
    ratio = (template.base_target or ref) / ref if ref else 1.0

    weekly = _personal_weekly(user.id, template, db) if has_history else None
    if weekly and weekly > 0:
        baseline, personalized = weekly, True
    else:
        exp = EXPERIENCE_FACTOR.get(user.experience_level or "beginner", 1.0)
        baseline, personalized = ref * exp, False

    factor = TREND_FACTOR.get(trend or "", 1.0)
    raw    = baseline * ratio * factor
    target = _round_to(max(lo, min(hi, raw)), step)
    target = max(int(lo), min(int(hi), target))
    return float(target), round(baseline, 2), personalized


def _to_user_mission_out(um: UserMission) -> UserMissionOut:
    tmpl = um.template
    # Use adjusted_target in description so the text matches the progress bar target.
    desc = tmpl.description_template.replace("{target}", str(int(um.adjusted_target)))
    return UserMissionOut(
        id=um.id,
        mission_template_id=um.mission_template_id,
        name=tmpl.name,
        type=tmpl.type,
        description=desc,
        adaptation_note=_TREND_NOTE.get(um.applied_trend) if um.applied_trend else None,
        applied_trend=um.applied_trend,
        adjusted_target=um.adjusted_target,
        current_progress=um.current_progress,
        status=um.status,
        xp_reward=tmpl.base_xp,
        coins_reward=tmpl.base_coins,
        started_at=um.started_at,
        expires_at=um.expires_at,
        completed_at=um.completed_at,
    )


@router.get("", response_model=AvailableMissionsOut)
def get_missions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the user's active missions + available templates they can pick from.
    """
    now = datetime.now(timezone.utc)

    # Active missions (not expired, not completed)
    active = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .all()
    )

    # Recently completed (last 7 days)
    completed = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "completed",
            UserMission.completed_at > now - timedelta(days=7),
        )
        .all()
    )

    # Recently expired (last 7 days) — surfaced once to the user, then dismissed client-side
    expired = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "expired",
            UserMission.expires_at > now - timedelta(days=7),
        )
        .all()
    )

    active_out = [_to_user_mission_out(m) for m in active]
    completed_out = [_to_user_mission_out(m) for m in completed]
    expired_out = [_to_user_mission_out(m) for m in expired]

    # Available templates (exclude ones the user already has active)
    active_template_ids = {m.mission_template_id for m in active}
    all_templates = db.query(MissionTemplate).all()

    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).first()
    user_path = progress.campaign_path if progress else None

    # Latest ML trend drives both ordering (which missions surface first) and the
    # preview target (how hard they'll be) — computed once for the whole list.
    latest_pred = (
        db.query(MlPrediction)
        .filter(MlPrediction.user_id == current_user.id)
        .order_by(MlPrediction.prediction_date.desc())
        .first()
    )
    trend = latest_pred.trend if latest_pred else None
    has_history = _has_recent_history(current_user.id, db)

    type_priority = GOAL_TYPE_PRIORITY.get(current_user.primary_goal or "strength", {})
    default_priority = len(type_priority)  # unrecognized types go last

    def _focus_rank(focus: str | None) -> int:
        # Trend-matched missions surface first, then universal, then the rest.
        if trend and focus == trend:
            return 0
        if not focus:
            return 1
        return 2

    eligible = []
    for t in all_templates:
        if t.id in active_template_ids:
            continue
        # Hide path-specific missions until the user has chosen a matching path.
        if t.campaign_path_filter:
            if not user_path or t.campaign_path_filter != user_path:
                continue
        eligible.append(t)

    eligible.sort(key=lambda t: (
        _focus_rank(t.trend_focus),
        type_priority.get(t.type, default_priority),
        -t.base_xp,
    ))

    available = []
    for t in eligible:
        tmpl_out = MissionTemplateOut.model_validate(t)
        tmpl_out.category = MISSION_TYPE_CATEGORY.get(t.type, t.type)
        # preview_target now equals the real target the user will get (no jump on accept).
        target, _, _ = _compute_target(current_user, t, db, trend, has_history)
        tmpl_out.preview_target = target
        available.append(tmpl_out)

    reroll_available, next_reroll_at = _reroll_status(progress, now)

    return AvailableMissionsOut(
        active=active_out,
        completed=completed_out,
        expired=expired_out,
        available=available,
        trend=trend,
        reroll_available=reroll_available,
        reroll_cost=REROLL_COST_COINS,
        next_reroll_at=next_reroll_at,
    )


@router.post("/{template_id}/accept", response_model=UserMissionOut, status_code=201)
def accept_mission(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a mission template — creates a UserMission with adjusted target."""
    template = db.query(MissionTemplate).filter(MissionTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Mission template not found")


    # Defense-in-depth: path-locked templates require a matching campaign_path.
    # The /missions list already filters these out, but a client cannot bypass
    # the gate by accepting a known template id directly.
    if template.campaign_path_filter:
        progress_for_path = db.query(UserProgress).filter(
            UserProgress.user_id == current_user.id
        ).first()
        user_path = progress_for_path.campaign_path if progress_for_path else None
        if not user_path or template.campaign_path_filter != user_path:
            raise HTTPException(
                status_code=403,
                detail="This mission requires a matching campaign path. Choose your path first.",
            )

    # Check if already active
    now = datetime.now(timezone.utc)
    existing = (
        db.query(UserMission)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.mission_template_id == template_id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Mission already active")

    # Lock the user's progress row to serialize all mission accepts for this user.
    # This prevents the race where 0 active missions exist (no rows to lock),
    # allowing 3+ concurrent accepts to all pass the limit check.
    db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).with_for_update().first()

    # Max 2 active missions at a time (serialized by the progress lock above)
    active_count = (
        db.query(UserMission)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .all()
    )
    if len(active_count) >= 2:
        raise HTTPException(status_code=400, detail="Maximum 2 active missions. Complete or wait for one to expire.")

    # Adaptive target: personal baseline × template difficulty × ML trend factor.
    trend = _latest_trend(current_user.id, db)
    has_history = _has_recent_history(current_user.id, db)
    adjusted_target, baseline_value, _ = _compute_target(
        current_user, template, db, trend, has_history
    )

    mission = UserMission(
        user_id=current_user.id,
        mission_template_id=template_id,
        adjusted_target=adjusted_target,
        applied_trend=trend,
        baseline_value=baseline_value,
        current_progress=0.0,
        status="active",
        expires_at=now + timedelta(days=template.duration_days),
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    # Load template for response
    mission = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(UserMission.id == mission.id)
        .first()
    )
    return _to_user_mission_out(mission)


@router.post("/{user_mission_id}/reroll", response_model=UserMissionOut, status_code=200)
def reroll_mission(
    user_mission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace one active mission with a randomly-picked different template.

    Rate-limited to once per `REROLL_COOLDOWN_DAYS` and costs `REROLL_COST_COINS`.
    Intended for cases where the assigned mission is physically unfeasible
    (injury, equipment access, etc.) — not a free re-roll until you like the offer.
    """
    now = datetime.now(timezone.utc)

    # Lock the progress row to serialize coin debit + reroll-timestamp update
    progress = (
        db.query(UserProgress)
        .filter(UserProgress.user_id == current_user.id)
        .with_for_update()
        .first()
    )
    if progress is None:
        raise HTTPException(status_code=404, detail="User progress not found")

    # Cooldown gate
    available, next_at = _reroll_status(progress, now)
    if not available:
        raise HTTPException(
            status_code=429,
            detail=f"Reroll on cooldown. Next available at {next_at.isoformat() if next_at else 'unknown'}.",
        )

    # Coin gate
    if progress.coins < REROLL_COST_COINS:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough coins. Reroll costs {REROLL_COST_COINS}, you have {progress.coins}.",
        )

    # Find the mission to reroll — must be active and owned by the user
    target = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(
            UserMission.id == user_mission_id,
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
        )
        .first()
    )
    if target is None:
        raise HTTPException(status_code=404, detail="Active mission not found")

    # Pool of replacement templates: respect path filter, exclude the current
    # template (no point swapping to the same one) and any other actives.
    other_active_ids = {
        m.mission_template_id
        for m in db.query(UserMission)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status == "active",
            UserMission.expires_at > now,
            UserMission.id != target.id,
        )
        .all()
    }
    user_path = progress.campaign_path

    candidates: list[MissionTemplate] = []
    for t in db.query(MissionTemplate).all():
        if t.id == target.mission_template_id:
            continue
        if t.id in other_active_ids:
            continue
        if t.campaign_path_filter:
            if not user_path or t.campaign_path_filter != user_path:
                continue
        candidates.append(t)

    if not candidates:
        raise HTTPException(status_code=409, detail="No alternative missions available to reroll into.")

    new_template = random.choice(candidates)

    # Mark the old mission as rerolled so progress history is preserved
    target.status = "rerolled"

    # Adaptive target: same logic as accept.
    trend = _latest_trend(current_user.id, db)
    has_history = _has_recent_history(current_user.id, db)
    adjusted_target, baseline_value, _ = _compute_target(
        current_user, new_template, db, trend, has_history
    )

    new_mission = UserMission(
        user_id=current_user.id,
        mission_template_id=new_template.id,
        adjusted_target=adjusted_target,
        applied_trend=trend,
        baseline_value=baseline_value,
        current_progress=0.0,
        status="active",
        expires_at=now + timedelta(days=new_template.duration_days),
    )
    db.add(new_mission)

    # Charge coins + start the cooldown
    progress.coins -= REROLL_COST_COINS
    progress.last_mission_reroll_at = now

    db.commit()
    db.refresh(new_mission)

    new_mission = (
        db.query(UserMission)
        .options(joinedload(UserMission.template))
        .filter(UserMission.id == new_mission.id)
        .first()
    )
    return _to_user_mission_out(new_mission)
