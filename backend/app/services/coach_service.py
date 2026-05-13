"""
Coach message generation.

generate_message(user_id, prediction, db)
  → creates a CoachMessage tied to the given MlPrediction.
  Tries the LLM first; falls back to hardcoded templates on any failure
  (no API key, timeout, rate limit, bad response, etc.).
  Idempotent: returns None if a message already exists for that prediction_id.
"""
from __future__ import annotations

import logging
import random
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.gamification import UserProgress
from app.models.ml import CoachMessage, MlPrediction
from app.services import llm_service

logger = logging.getLogger(__name__)


# 2 variants per slot for natural variety. (3 trends × 5 features × 2 = 30 messages)
_TEMPLATES: dict[str, dict[str, list[str]]] = {
    "improving": {
        "weekly_volume_delta": [
            "Your training volume jumped this week — keep that momentum going.",
            "Big spike in volume. The work is paying off.",
        ],
        "session_frequency": [
            "You're hitting the gym consistently. That's the foundation of progress.",
            "Session count is up. You're building real momentum.",
        ],
        "load_progression": [
            "Weights are climbing. Strength gains are showing up clearly.",
            "Your lifts are heavier than last week — real progression.",
        ],
        "consistency_score": [
            "Your schedule discipline is exactly why you're improving.",
            "Showing up regularly is paying dividends. Keep it.",
        ],
        "nutrition_consistency": [
            "Tracking nutrition alongside training is the right move.",
            "Your nutrition logging matches your training discipline. Both matter.",
        ],
    },
    "plateau": {
        "weekly_volume_delta": [
            "Volume's been flat. Try adding one extra set per main lift this week.",
            "Same volume, same results. A small bump could shift things.",
        ],
        "session_frequency": [
            "Same number of sessions for a while. One more this week could break the plateau.",
            "Frequency is steady — push for one extra session if your schedule allows.",
        ],
        "load_progression": [
            "Weights have stalled. Try +2.5kg on your next big lift.",
            "Loads have been stable. Time for a small progression test.",
        ],
        "consistency_score": [
            "Steady but not improving — consider varying your routine or rep scheme.",
            "Consistent, but stagnant. A new program might unlock the next gear.",
        ],
        "nutrition_consistency": [
            "Food log is patchy. Logging alone often correlates with results.",
            "Nutrition tracking is inconsistent. Try 3 logged meals daily this week.",
        ],
    },
    "declining": {
        "weekly_volume_delta": [
            "Volume dropped this week. Even a short session helps maintain progress.",
            "Volume's down — it happens. Aim for one solid session this week.",
        ],
        "session_frequency": [
            "Fewer sessions lately. What's getting in the way?",
            "Session count is down. Pick one realistic day this week and lock it in.",
        ],
        "load_progression": [
            "Weights have dropped. Could be deload, fatigue, or technique — worth checking.",
            "Loads are lower than usual. Listen to your body, but don't drop off entirely.",
        ],
        "consistency_score": [
            "Schedule's slipping. One realistic day this week is better than zero.",
            "Consistency dropped. Restart small — one workout this week is the win.",
        ],
        "nutrition_consistency": [
            "Nutrition tracking dropped off. Even 1-2 meals logged daily helps.",
            "Food log is empty lately. Track one meal a day to restart the habit.",
        ],
    },
}

_TONE_MAP = {
    "improving": "motivating",
    "plateau":   "neutral",
    "declining": "warning",
}


def _top_feature(shap_values: dict[str, float]) -> str | None:
    """Feature with highest positive SHAP — the strongest driver of the predicted class."""
    if not shap_values:
        return None
    return max(shap_values.items(), key=lambda kv: kv[1])[0]


def _template_message(trend: str, shap_values: dict[str, float]) -> str | None:
    feat = _top_feature(shap_values)
    if feat is None or trend not in _TEMPLATES:
        return None
    variants = _TEMPLATES[trend].get(feat)
    if not variants:
        return None
    return random.choice(variants)


def _load_user_context(user_id: UUID, db: Session) -> dict:
    """Light user snapshot for the LLM prompt. Safe defaults if any row is missing."""
    user     = db.query(User).filter(User.id == user_id).first()
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    return {
        "experience_level": getattr(user,     "experience_level", "beginner"),
        "primary_goal":     getattr(user,     "primary_goal",     "strength"),
        "level":            getattr(progress, "level",            1),
        "current_streak":   getattr(progress, "current_streak",   0),
        "total_workouts":   getattr(progress, "total_workouts",   0),
    }


def generate_message(
    user_id:    UUID,
    prediction: MlPrediction,
    db:         Session,
) -> CoachMessage | None:
    """
    Create a CoachMessage tied to the given prediction.
    Idempotent on prediction_id: re-runs of the nightly job won't duplicate messages.
    Returns the new message, or None if one already exists / no template match.
    """
    existing = (
        db.query(CoachMessage)
        .filter(CoachMessage.prediction_id == prediction.id)
        .first()
    )
    if existing:
        return None

    trend = prediction.trend
    shap  = prediction.shap_values or {}

    # Templates are the canonical fallback — if even they don't match, skip.
    fallback_text = _template_message(trend, shap)
    if fallback_text is None:
        return None

    # Try LLM; on any failure keep the template text.
    text = fallback_text
    try:
        ctx = _load_user_context(user_id, db)
        text = llm_service.generate_coach_message(
            trend       = trend,
            confidence  = float(prediction.confidence or 0.0),
            shap_values = shap,
            user_context = ctx,
        )
    except Exception as e:
        logger.warning("LLM coach message failed, using template: %s", e)

    msg = CoachMessage(
        user_id       = user_id,
        prediction_id = prediction.id,
        message_text  = text,
        tone          = _TONE_MAP.get(trend, "neutral"),
    )
    db.add(msg)
    db.flush()
    return msg
