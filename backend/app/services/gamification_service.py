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


# ── Reward tables ─────────────────────────────────────────────────────────────

# XP and coins awarded when a chapter is COMPLETED (i.e. player advances past it)
CHAPTER_REWARDS: dict[int, dict[str, int]] = {
    1: {"xp": 75,  "coins": 30},
    2: {"xp": 125, "coins": 50},
    3: {"xp": 150, "coins": 60},
    4: {"xp": 200, "coins": 80},
    5: {"xp": 300, "coins": 120},
}

# Bonus on top of the final chapter reward when the whole campaign is finished
CAMPAIGN_COMPLETION_BONUS: dict[str, int] = {"xp": 500, "coins": 200}


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
        "chapter_number":   int | None,   # completed chapter number
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
    if not check_chapter_completion(progress, current):
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

    # Determine rewards for the completed chapter
    completed_num = current.chapter_number
    reward = CHAPTER_REWARDS.get(completed_num, {"xp": 0, "coins": 0})
    xp_awarded    = reward["xp"]
    coins_awarded = reward["coins"]
    campaign_complete = False

    if next_chapter:
        progress.current_chapter_id = next_chapter.id
        # Clear path when entering a NEW branch chapter (not when leaving one)
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
        else:
            # All campaigns complete
            progress.current_chapter_id = None

    # Award XP and coins for the completed chapter
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
