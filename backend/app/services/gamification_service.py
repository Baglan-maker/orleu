# app/services/gamification_service.py
"""
Chapter progression logic for campaign advancement.

Entry points:
  try_advance_chapter(user_id, db) — call after any event that may unlock the next chapter
    (workout logged, mission completed, campaign path chosen).
  check_chapter_completion(user_progress, chapter) — pure condition check, no DB writes.
"""
from uuid import UUID
from sqlalchemy.orm import Session

from app.models import (
    UserProgress, Campaign, CampaignChapter,
    Achievement, UserAchievement,
)


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


# ── Chapter completion conditions ─────────────────────────────────────────────

def check_chapter_completion(user_progress: UserProgress, chapter: CampaignChapter) -> bool:
    """
    Returns True only when ALL conditions for the chapter_number are satisfied.
    Uses persistent counters stored on UserProgress (total_workouts, missions_completed_count).
    """
    n  = chapter.chapter_number
    tw = user_progress.total_workouts or 0
    mc = user_progress.missions_completed_count or 0

    if n == 1:
        # First Steps — log 3 sessions
        return tw >= 3

    elif n == 2:
        # Building Habits — log 6 sessions + complete 1 mission
        return tw >= 6 and mc >= 1

    elif n == 3:
        # Branch chapter (The Crossroads / The Fork).
        # Never auto-completes from workout/mission counters alone.
        # Returns True only after the user explicitly selects a path via PATCH /api/progress.
        return user_progress.campaign_path is not None

    elif n == 4:
        # Momentum / Mastery — 12 sessions + 3 missions + path chosen
        return tw >= 12 and mc >= 3 and user_progress.campaign_path is not None

    elif n == 5:
        # The Ascent / Peak Form — 20 sessions + 6 missions
        return tw >= 20 and mc >= 6

    else:
        return False


# ── Chapter advancement ────────────────────────────────────────────────────────

def try_advance_chapter(user_id: UUID, db: Session) -> bool:
    """
    Tries to advance the user to the next chapter.
    - Advances AT MOST one chapter per call (idempotent).
    - Assigns the first campaign if the user has none.
    - Commits any change made.
    Returns True if an advancement (or initial assignment) was made.
    """
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        return False

    # ── Step 1: No campaign yet — assign first and set chapter 1 ─────────────
    if progress.current_campaign_id is None:
        first = (
            db.query(Campaign)
            .filter(Campaign.is_active == True)
            .order_by(Campaign.order_index)
            .first()
        )
        if not first:
            return False
        chapters = (
            db.query(CampaignChapter)
            .filter(CampaignChapter.campaign_id == first.id)
            .order_by(CampaignChapter.chapter_number)
            .all()
        )
        if not chapters:
            return False
        progress.current_campaign_id = first.id
        progress.current_chapter_id  = chapters[0].id
        db.commit()
        return True

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
        return False

    # ── Step 3: Load current chapter ─────────────────────────────────────────
    current = db.query(CampaignChapter).filter(
        CampaignChapter.id == progress.current_chapter_id
    ).first()
    if not current:
        return False

    # ── Step 4: Branch gate — wait for explicit path selection ───────────────
    if current.has_branch and progress.campaign_path is None:
        return False

    # ── Step 5: Check completion conditions ──────────────────────────────────
    if not check_chapter_completion(progress, current):
        return False

    # ── Step 6: Find next chapter in same campaign ────────────────────────────
    next_chapter = (
        db.query(CampaignChapter)
        .filter(
            CampaignChapter.campaign_id == progress.current_campaign_id,
            CampaignChapter.chapter_number == current.chapter_number + 1,
        )
        .first()
    )

    if next_chapter:
        progress.current_chapter_id = next_chapter.id
    else:
        # ── Step 7: Campaign complete — move to next campaign ─────────────────
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
        else:
            # All campaigns complete
            progress.current_chapter_id = None

    db.commit()
    return True
