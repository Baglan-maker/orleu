# app/services/gamification_service.py
"""
Chapter progression logic for campaign advancement.

Entry points:
  try_advance_chapter(user_id, db)     — call after any event that may unlock the next chapter
  check_chapter_completion(user_progress, chapter, db) — returns bool
  get_chapter_requirements(user_progress, chapter, db) — returns list[ChapterRequirement]
"""
from __future__ import annotations
from dataclasses import dataclass
from uuid import UUID
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    UserProgress, Campaign, CampaignChapter,
    Achievement, UserAchievement,
    PersonalRecord, PersonalRecordHistory,
)
from app.models.workout import Workout, WorkoutExercise, ExerciseLibrary


# ── PR tracking ───────────────────────────────────────────────────────────────

@dataclass
class PRResult:
    exercise_id:     UUID
    exercise_name:   str
    new_1rm:         float
    previous_1rm:    Optional[float]
    improvement_pct: Optional[float]
    weight_kg:       float
    reps:            int


def _epley(weight_kg: float, reps: int) -> float:
    if reps > 12:
        return weight_kg
    return round(weight_kg * (1 + reps / 30), 2)


def check_and_update_prs(
    user_id: UUID,
    workout_exercises: list[WorkoutExercise],
    db: Session,
) -> list[PRResult]:
    """
    For each exercise in the workout, compute the estimated 1RM via Epley
    and update personal_records + personal_record_history if a new PR is set.
    Returns a list of PRResult for every newly set record.
    """
    results: list[PRResult] = []
    now = datetime.now(timezone.utc)

    for we in workout_exercises:
        if we.weight_kg is None or we.weight_kg <= 0 or we.reps < 1:
            continue

        current_1rm = _epley(we.weight_kg, we.reps)
        exercise_name = we.exercise.name if we.exercise else "Unknown"

        existing = (
            db.query(PersonalRecord)
            .filter_by(user_id=user_id, exercise_id=we.exercise_id)
            .first()
        )

        if existing is None:
            db.add(PersonalRecord(
                user_id=user_id,
                exercise_id=we.exercise_id,
                estimated_1rm=current_1rm,
                weight_kg=we.weight_kg,
                reps=we.reps,
                sets=we.sets,
                achieved_at=now,
                previous_1rm=None,
                improvement_pct=None,
            ))
            db.add(PersonalRecordHistory(
                user_id=user_id,
                exercise_id=we.exercise_id,
                estimated_1rm=current_1rm,
                weight_kg=we.weight_kg,
                reps=we.reps,
                achieved_at=now,
            ))
            results.append(PRResult(
                exercise_id=we.exercise_id,
                exercise_name=exercise_name,
                new_1rm=current_1rm,
                previous_1rm=None,
                improvement_pct=None,
                weight_kg=we.weight_kg,
                reps=we.reps,
            ))

        elif current_1rm > existing.estimated_1rm:
            previous_1rm = existing.estimated_1rm
            improvement_pct = round(
                (current_1rm - previous_1rm) / previous_1rm * 100, 1
            )
            existing.estimated_1rm  = current_1rm
            existing.weight_kg      = we.weight_kg
            existing.reps           = we.reps
            existing.sets           = we.sets
            existing.achieved_at    = now
            existing.previous_1rm   = previous_1rm
            existing.improvement_pct = improvement_pct
            db.add(PersonalRecordHistory(
                user_id=user_id,
                exercise_id=we.exercise_id,
                estimated_1rm=current_1rm,
                weight_kg=we.weight_kg,
                reps=we.reps,
                achieved_at=now,
            ))
            results.append(PRResult(
                exercise_id=we.exercise_id,
                exercise_name=exercise_name,
                new_1rm=current_1rm,
                previous_1rm=previous_1rm,
                improvement_pct=improvement_pct,
                weight_kg=we.weight_kg,
                reps=we.reps,
            ))

    if results:
        db.flush()

    return results


# ── Reward tables ─────────────────────────────────────────────────────────────

CHAPTER_REWARDS: dict[int, dict[str, int]] = {
    1: {"xp": 75,  "coins": 30},
    2: {"xp": 125, "coins": 50},
    3: {"xp": 150, "coins": 60},
    4: {"xp": 200, "coins": 80},
    5: {"xp": 300, "coins": 120},
}

CAMPAIGN_COMPLETION_BONUS: dict[str, int] = {"xp": 500, "coins": 200}


# ── ChapterRequirement dataclass (serialised by campaigns.py) ────────────────

@dataclass
class ChapterRequirement:
    label:   str
    current: float
    target:  float
    met:     bool


# ── Achievement checking ──────────────────────────────────────────────────────

def check_and_award_achievements(user_id: UUID, db: Session) -> list[Achievement]:
    """
    Check all achievements not yet earned by user.
    Award any whose condition is now met.
    Return list of newly awarded Achievement objects.
    """
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        return []

    already_earned = {
        ua.achievement_id
        for ua in db.query(UserAchievement).filter(UserAchievement.user_id == user_id).all()
    }

    stats = {
        "streak_days":        progress.current_streak,
        "total_sessions":     progress.total_workouts or 0,
        "missions_completed": progress.missions_completed_count or 0,
    }

    all_achievements = db.query(Achievement).all()
    newly_awarded: list[Achievement] = []

    for achievement in all_achievements:
        if achievement.id in already_earned:
            continue
        user_value = stats.get(achievement.condition_type, 0)
        if user_value >= achievement.condition_value:
            db.add(UserAchievement(user_id=user_id, achievement_id=achievement.id))
            newly_awarded.append(achievement)

    if newly_awarded:
        db.flush()

    return newly_awarded


# ── Helper queries ────────────────────────────────────────────────────────────

def _campaign_workouts(user_id: UUID, progress: UserProgress, db: Session) -> list[Workout]:
    """All workouts logged since campaign baseline (ordered oldest-first)."""
    baseline = progress.campaign_started_workouts or 0
    # We can't filter by row-number in SQLAlchemy easily, so fetch all and slice.
    # Workouts are few in practice (< 100 per campaign), so this is fine.
    all_w = (
        db.query(Workout)
        .filter(Workout.user_id == user_id)
        .order_by(Workout.workout_date, Workout.created_at)
        .all()
    )
    return all_w[baseline:]


def _workouts_in_campaign(user_id: UUID, progress: UserProgress, db: Session) -> int:
    return (progress.total_workouts or 0) - (progress.campaign_started_workouts or 0)


def _missions_in_campaign(progress: UserProgress) -> int:
    return (progress.missions_completed_count or 0) - (progress.campaign_started_missions or 0)


def _distinct_days_this_week(user_id: UUID, db: Session) -> int:
    """Count distinct workout_date values in the last 7 calendar days."""
    cutoff = date.today() - timedelta(days=6)
    rows = (
        db.query(func.count(func.distinct(Workout.workout_date)))
        .filter(Workout.user_id == user_id, Workout.workout_date >= cutoff)
        .scalar()
    )
    return rows or 0


def _max_distinct_days_in_any_week(user_id: UUID, db: Session) -> int:
    """Max distinct training days found in any rolling 7-day window (for the whole history)."""
    dates = [
        row[0] for row in
        db.query(Workout.workout_date)
        .filter(Workout.user_id == user_id)
        .distinct()
        .order_by(Workout.workout_date)
        .all()
    ]
    if not dates:
        return 0
    best = 0
    for i, d in enumerate(dates):
        window_end = d + timedelta(days=6)
        count = sum(1 for dd in dates[i:] if dd <= window_end)
        best = max(best, count)
    return best


def _has_workout_with_n_exercises(workouts: list[Workout], n: int, db: Session) -> bool:
    """True if any workout in the list has >= n exercises."""
    for w in workouts:
        ex_count = (
            db.query(func.count(WorkoutExercise.id))
            .filter(WorkoutExercise.workout_id == w.id)
            .scalar()
        )
        if (ex_count or 0) >= n:
            return True
    return False


def _total_sets_in_campaign(workouts: list[Workout], db: Session) -> int:
    """Sum of sets across all campaign workouts."""
    if not workouts:
        return 0
    wids = [w.id for w in workouts]
    result = (
        db.query(func.sum(WorkoutExercise.sets))
        .filter(WorkoutExercise.workout_id.in_(wids))
        .scalar()
    )
    return int(result or 0)


def _total_reps_in_campaign(workouts: list[Workout], db: Session) -> int:
    """Sum of sets*reps across all campaign workouts."""
    if not workouts:
        return 0
    wids = [w.id for w in workouts]
    rows = (
        db.query(WorkoutExercise.sets, WorkoutExercise.reps)
        .filter(WorkoutExercise.workout_id.in_(wids))
        .all()
    )
    return int(sum(r.sets * r.reps for r in rows))


def _total_volume_in_campaign(workouts: list[Workout], db: Session) -> float:
    """Sum of sets*reps*weight_kg across all campaign workouts."""
    if not workouts:
        return 0.0
    wids = [w.id for w in workouts]
    rows = (
        db.query(WorkoutExercise.sets, WorkoutExercise.reps, WorkoutExercise.weight_kg)
        .filter(WorkoutExercise.workout_id.in_(wids))
        .all()
    )
    return sum(r.sets * r.reps * (r.weight_kg or 0) for r in rows)


def _heavy_sessions_count(workouts: list[Workout], threshold: float, db: Session) -> int:
    """Count workouts where total volume (sets*reps*weight) >= threshold."""
    count = 0
    for w in workouts:
        rows = (
            db.query(WorkoutExercise.sets, WorkoutExercise.reps, WorkoutExercise.weight_kg)
            .filter(WorkoutExercise.workout_id == w.id)
            .all()
        )
        vol = sum(r.sets * r.reps * (r.weight_kg or 0) for r in rows)
        if vol >= threshold:
            count += 1
    return count


def _max_single_workout_volume(workouts: list[Workout], db: Session) -> float:
    """Highest volume (sets*reps*weight_kg) across a single workout."""
    best = 0.0
    for w in workouts:
        rows = (
            db.query(WorkoutExercise.sets, WorkoutExercise.reps, WorkoutExercise.weight_kg)
            .filter(WorkoutExercise.workout_id == w.id)
            .all()
        )
        vol = sum(r.sets * r.reps * (r.weight_kg or 0) for r in rows)
        best = max(best, vol)
    return best


def _has_pr_in_campaign(user_id: UUID, campaign_workouts: list[Workout], db: Session) -> bool:
    """
    True if any exercise in the campaign workouts has a max weight that exceeds
    the max weight for that exercise in all PRE-campaign workouts.
    """
    if not campaign_workouts:
        return False

    campaign_wids = {w.id for w in campaign_workouts}
    all_wids = {
        row[0] for row in
        db.query(Workout.id).filter(Workout.user_id == user_id).all()
    }
    pre_wids = all_wids - campaign_wids

    # Get best weight per exercise inside campaign
    camp_rows = (
        db.query(WorkoutExercise.exercise_id, func.max(WorkoutExercise.weight_kg).label("best"))
        .filter(WorkoutExercise.workout_id.in_(campaign_wids))
        .group_by(WorkoutExercise.exercise_id)
        .all()
    )

    if not pre_wids:
        # No pre-campaign history — any lift with weight > 0 counts as a PR
        return any(r.best and r.best > 0 for r in camp_rows)

    # Get best weight per exercise before campaign
    pre_rows = (
        db.query(WorkoutExercise.exercise_id, func.max(WorkoutExercise.weight_kg).label("best"))
        .filter(WorkoutExercise.workout_id.in_(pre_wids))
        .group_by(WorkoutExercise.exercise_id)
        .all()
    )
    pre_best: dict = {r.exercise_id: r.best or 0 for r in pre_rows}

    for r in camp_rows:
        prev = pre_best.get(r.exercise_id, 0)
        if (r.best or 0) > prev:
            return True

    return False


def _volume_record_broken(campaign_workouts: list[Workout], db: Session) -> bool:
    """
    True if the most recent workout's volume exceeds every previous workout's volume.
    (Useful for 'break your volume record' condition.)
    """
    if len(campaign_workouts) < 2:
        return False
    vols = [_max_single_workout_volume([w], db) for w in campaign_workouts]
    return vols[-1] > max(vols[:-1])


def _muscle_groups_trained(campaign_workouts: list[Workout], db: Session) -> set[str]:
    """Distinct muscle_group values across all campaign workouts."""
    if not campaign_workouts:
        return set()
    wids = [w.id for w in campaign_workouts]
    rows = (
        db.query(ExerciseLibrary.muscle_group)
        .join(WorkoutExercise, WorkoutExercise.exercise_id == ExerciseLibrary.id)
        .filter(WorkoutExercise.workout_id.in_(wids))
        .distinct()
        .all()
    )
    return {r.muscle_group.lower() for r in rows}


# ── Campaign name detection ───────────────────────────────────────────────────

def _campaign_order(user_id: UUID, progress: UserProgress, db: Session) -> int:
    """Return the order_index of the user's current campaign (0 = first)."""
    if not progress.current_campaign_id:
        return 0
    order = (
        db.query(Campaign.order_index)
        .filter(Campaign.id == progress.current_campaign_id)
        .scalar()
    )
    return order or 0


# ── Requirement builders per chapter ─────────────────────────────────────────
# Each function returns list[ChapterRequirement] with live current values.

def _reqs_foundation_ch1(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    tw = _workouts_in_campaign(user_id, progress, db)
    return [
        ChapterRequirement(
            label=f"Log {min(tw, 3)}/3 workouts",
            current=tw, target=3, met=tw >= 3,
        ),
    ]


def _reqs_foundation_ch2(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    distinct = _distinct_days_this_week(user_id, db)
    camp_ws  = _campaign_workouts(user_id, progress, db)
    has4     = _has_workout_with_n_exercises(camp_ws, 4, db)
    return [
        ChapterRequirement(
            label="Train 3 different days this week",
            current=distinct, target=3, met=distinct >= 3,
        ),
        ChapterRequirement(
            label="One full workout (4+ exercises)",
            current=1.0 if has4 else 0.0, target=1, met=has4,
        ),
    ]


def _reqs_crossroads(progress: UserProgress) -> list[ChapterRequirement]:
    chosen = progress.campaign_path is not None
    return [
        ChapterRequirement(
            label="Choose Path A or B to continue",
            current=1.0 if chosen else 0.0, target=1, met=chosen,
        ),
    ]


def _reqs_foundation_ch4a(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    camp_ws = _campaign_workouts(user_id, progress, db)
    mc      = _missions_in_campaign(progress)
    has_pr  = _has_pr_in_campaign(user_id, camp_ws, db)
    return [
        ChapterRequirement(
            label="Beat a personal record",
            current=1.0 if has_pr else 0.0, target=1, met=has_pr,
        ),
        ChapterRequirement(
            label="Complete 2 missions",
            current=mc, target=2, met=mc >= 2,
        ),
    ]


def _reqs_foundation_ch4b(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    best_week = _max_distinct_days_in_any_week(user_id, db)
    mc        = _missions_in_campaign(progress)
    return [
        ChapterRequirement(
            label="4 training days in one week",
            current=best_week, target=4, met=best_week >= 4,
        ),
        ChapterRequirement(
            label="Complete 2 missions",
            current=mc, target=2, met=mc >= 2,
        ),
    ]


def _reqs_foundation_ch5(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    camp_ws  = _campaign_workouts(user_id, progress, db)
    sets_tot = _total_sets_in_campaign(camp_ws, db)
    streak   = progress.current_streak or 0
    mc       = _missions_in_campaign(progress)
    return [
        ChapterRequirement(
            label="100 total sets this campaign",
            current=sets_tot, target=100, met=sets_tot >= 100,
        ),
        ChapterRequirement(
            label="5-day streak",
            current=streak, target=5, met=streak >= 5,
        ),
        ChapterRequirement(
            label="Complete 4 missions",
            current=mc, target=4, met=mc >= 4,
        ),
    ]


def _reqs_chronicles_ch1(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    camp_ws = _campaign_workouts(user_id, progress, db)
    heavy   = _heavy_sessions_count(camp_ws, 3000, db)
    return [
        ChapterRequirement(
            label="2 heavy sessions (3 000+ kg each)",
            current=heavy, target=2, met=heavy >= 2,
        ),
    ]


def _reqs_chronicles_ch2(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    camp_ws  = _campaign_workouts(user_id, progress, db)
    tw       = _workouts_in_campaign(user_id, progress, db)
    vol_rec  = _volume_record_broken(camp_ws, db)
    return [
        ChapterRequirement(
            label="Break your volume record",
            current=1.0 if vol_rec else 0.0, target=1, met=vol_rec,
        ),
        ChapterRequirement(
            label="4 workouts this campaign",
            current=tw, target=4, met=tw >= 4,
        ),
    ]


def _reqs_chronicles_ch4a(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    camp_ws = _campaign_workouts(user_id, progress, db)
    mc      = _missions_in_campaign(progress)
    has_pr  = _has_pr_in_campaign(user_id, camp_ws, db)
    return [
        ChapterRequirement(
            label="Set a personal record",
            current=1.0 if has_pr else 0.0, target=1, met=has_pr,
        ),
        ChapterRequirement(
            label="Complete 3 missions",
            current=mc, target=3, met=mc >= 3,
        ),
    ]


def _reqs_chronicles_ch4b(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    camp_ws   = _campaign_workouts(user_id, progress, db)
    total_reps = _total_reps_in_campaign(camp_ws, db)
    mc         = _missions_in_campaign(progress)
    return [
        ChapterRequirement(
            label="500 total reps this campaign",
            current=total_reps, target=500, met=total_reps >= 500,
        ),
        ChapterRequirement(
            label="Complete 3 missions",
            current=mc, target=3, met=mc >= 3,
        ),
    ]


def _reqs_chronicles_ch5(user_id: UUID, progress: UserProgress, db: Session) -> list[ChapterRequirement]:
    camp_ws   = _campaign_workouts(user_id, progress, db)
    mc        = _missions_in_campaign(progress)
    streak    = progress.current_streak or 0
    groups    = _muscle_groups_trained(camp_ws, db)
    key_groups = {"chest", "back", "legs"}
    covered   = len(key_groups & groups)
    return [
        ChapterRequirement(
            label="5 missions completed",
            current=mc, target=5, met=mc >= 5,
        ),
        ChapterRequirement(
            label="7-day streak",
            current=streak, target=7, met=streak >= 7,
        ),
        ChapterRequirement(
            label="Train chest, back AND legs",
            current=covered, target=3, met=covered >= 3,
        ),
    ]


# ── Dispatcher ───────────────────────────────────────────────────────────────

def get_chapter_requirements(
    user_id: UUID,
    progress: UserProgress,
    chapter:  CampaignChapter,
    db:       Session,
) -> list[ChapterRequirement]:
    """
    Returns live requirement progress for the given chapter.
    Chapter 3 (branch) is campaign-agnostic — always path selection.
    Chapters 4+ differ by campaign_path (A/B) and campaign order.
    """
    n    = chapter.chapter_number
    path = progress.campaign_path
    camp_order = _campaign_order(user_id, progress, db)  # 0 = Foundation, 1 = Iron Chronicles

    if n == 1:
        if camp_order == 0:
            return _reqs_foundation_ch1(user_id, progress, db)
        else:
            return _reqs_chronicles_ch1(user_id, progress, db)

    elif n == 2:
        if camp_order == 0:
            return _reqs_foundation_ch2(user_id, progress, db)
        else:
            return _reqs_chronicles_ch2(user_id, progress, db)

    elif n == 3:
        return _reqs_crossroads(progress)

    elif n == 4:
        if camp_order == 0:
            if path == "B":
                return _reqs_foundation_ch4b(user_id, progress, db)
            return _reqs_foundation_ch4a(user_id, progress, db)
        else:
            if path == "B":
                return _reqs_chronicles_ch4b(user_id, progress, db)
            return _reqs_chronicles_ch4a(user_id, progress, db)

    elif n == 5:
        if camp_order == 0:
            return _reqs_foundation_ch5(user_id, progress, db)
        else:
            return _reqs_chronicles_ch5(user_id, progress, db)

    return []


def check_chapter_completion(
    user_id:  UUID,
    progress: UserProgress,
    chapter:  CampaignChapter,
    db:       Session,
) -> bool:
    """Returns True when ALL requirements for the chapter are met."""
    # Branch gate: ch3 waits for explicit path selection only
    if chapter.has_branch:
        return progress.campaign_path is not None

    reqs = get_chapter_requirements(user_id, progress, chapter, db)
    return bool(reqs) and all(r.met for r in reqs)


# ── Chapter advancement ────────────────────────────────────────────────────────

def try_advance_chapter(user_id: UUID, db: Session) -> dict:
    """
    Tries to advance the user to the next chapter.
    - Advances AT MOST one chapter per call (idempotent).
    - Assigns the first campaign if the user has none.
    - Awards XP and coins when a chapter is completed.
    - Commits any change made.

    Returns a dict:
      {
        "advanced":         bool,
        "chapter_number":   int | None,
        "campaign_complete": bool,
        "xp":               int,
        "coins":            int,
      }
    """
    _no_advance = {"advanced": False, "chapter_number": None, "campaign_complete": False, "xp": 0, "coins": 0}

    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        return _no_advance

    # ── Step 1: No campaign yet — assign first and set chapter 1 ─────────────
    if progress.current_campaign_id is None:
        first = (
            db.query(Campaign)
            .filter(Campaign.is_active == True)
            .order_by(Campaign.order_index)
            .first()
        )
        if not first:
            return _no_advance
        chapters = (
            db.query(CampaignChapter)
            .filter(CampaignChapter.campaign_id == first.id)
            .order_by(CampaignChapter.chapter_number)
            .all()
        )
        if not chapters:
            return _no_advance
        progress.current_campaign_id = first.id
        progress.current_chapter_id  = chapters[0].id
        progress.campaign_path = None
        progress.campaign_started_workouts = progress.total_workouts or 0
        progress.campaign_started_missions = progress.missions_completed_count or 0
        db.commit()
        return {"advanced": True, "chapter_number": None, "campaign_complete": False, "xp": 0, "coins": 0}

    # ── Step 2: Has campaign but no chapter — re-assign chapter 1 ────────────
    if progress.current_chapter_id is None:
        chapters = (
            db.query(CampaignChapter)
            .filter(CampaignChapter.campaign_id == progress.current_campaign_id)
            .order_by(CampaignChapter.chapter_number)
            .all()
        )
        if chapters:
            progress.current_chapter_id = chapters[0].id
            db.commit()
        return _no_advance

    # ── Step 3: Load current chapter ─────────────────────────────────────────
    current = db.query(CampaignChapter).filter(
        CampaignChapter.id == progress.current_chapter_id
    ).first()
    if not current:
        return _no_advance

    # ── Step 4: Branch gate — wait for explicit path selection ───────────────
    if current.has_branch and progress.campaign_path is None:
        return _no_advance

    # ── Step 5: Check completion conditions ──────────────────────────────────
    if not check_chapter_completion(user_id, progress, current, db):
        return _no_advance

    # ── Step 6: Find next chapter in same campaign ────────────────────────────
    next_chapter = (
        db.query(CampaignChapter)
        .filter(
            CampaignChapter.campaign_id == progress.current_campaign_id,
            CampaignChapter.chapter_number == current.chapter_number + 1,
        )
        .first()
    )

    completed_num = current.chapter_number
    reward        = CHAPTER_REWARDS.get(completed_num, {"xp": 0, "coins": 0})
    xp_awarded    = reward["xp"]
    coins_awarded = reward["coins"]
    campaign_complete = False

    if next_chapter:
        progress.current_chapter_id = next_chapter.id
        if next_chapter.has_branch and not current.has_branch:
            progress.campaign_path = None
    else:
        # ── Step 7: Campaign complete — move to next campaign ─────────────────
        campaign_complete = True
        xp_awarded    += CAMPAIGN_COMPLETION_BONUS["xp"]
        coins_awarded += CAMPAIGN_COMPLETION_BONUS["coins"]

        current_order = (
            db.query(Campaign.order_index)
            .filter(Campaign.id == progress.current_campaign_id)
            .scalar()
        )
        next_campaign = (
            db.query(Campaign)
            .filter(
                Campaign.is_active == True,
                Campaign.order_index > current_order,
            )
            .order_by(Campaign.order_index)
            .first()
        )
        if next_campaign:
            next_chapters = (
                db.query(CampaignChapter)
                .filter(CampaignChapter.campaign_id == next_campaign.id)
                .order_by(CampaignChapter.chapter_number)
                .all()
            )
            progress.current_campaign_id = next_campaign.id
            progress.current_chapter_id  = next_chapters[0].id if next_chapters else None
            progress.campaign_path = None
            progress.campaign_started_workouts = progress.total_workouts or 0
            progress.campaign_started_missions = progress.missions_completed_count or 0
        else:
            progress.current_chapter_id = None

    progress.xp    = (progress.xp    or 0) + xp_awarded
    progress.coins = (progress.coins or 0) + coins_awarded

    db.commit()
    return {
        "advanced":          True,
        "chapter_number":    completed_num,
        "campaign_complete": campaign_complete,
        "xp":                xp_awarded,
        "coins":             coins_awarded,
    }
