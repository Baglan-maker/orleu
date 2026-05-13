"""
LLM client for coach-message generation.

generate_coach_message(trend, confidence, shap_values, user_context) -> str
  → returns a 1-2 sentence coach message from an LLM via OpenRouter.
  Raises on any failure (missing key, timeout, HTTP error, empty response).
  The caller is expected to catch and fall back to a hardcoded template.

Sync by design: the nightly job iterates users sequentially and does not
benefit from concurrency here. Keeping it sync also avoids forcing
coach_service / nightly_ml to become async.
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_SYSTEM_PROMPT = (
    "You are a concise fitness coach speaking directly to one trainee. "
    "Reply with 1-2 plain sentences (max 220 characters total). "
    "No emojis, no markdown, no greetings, no sign-off, no quotation marks. "
    "Be specific to the data: name the trend and the driving factor in your own words. "
    "Tone: motivating if improving, neutral if plateau, supportive (never harsh) if declining."
)


def _build_user_prompt(
    trend:       str,
    confidence:  float,
    shap_values: dict[str, float],
    ctx:         dict,
) -> str:
    top = sorted(shap_values.items(), key=lambda kv: kv[1], reverse=True)[:3]
    shap_lines = "\n".join(f"  - {name}: {val:+.2f}" for name, val in top) or "  (no shap data)"

    return (
        f"Trend: {trend} (confidence {confidence:.2f})\n"
        f"Top SHAP drivers (positive = pushed prediction toward this trend):\n"
        f"{shap_lines}\n"
        f"Trainee context:\n"
        f"  - experience_level: {ctx.get('experience_level', 'unknown')}\n"
        f"  - primary_goal:     {ctx.get('primary_goal', 'unknown')}\n"
        f"  - level:            {ctx.get('level', 1)}\n"
        f"  - current_streak:   {ctx.get('current_streak', 0)} days\n"
        f"  - total_workouts:   {ctx.get('total_workouts', 0)}\n"
        f"Write the coach message now."
    )


def _call_openrouter(model: str, system: str, user: str, timeout: float) -> str:
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type":  "application/json",
        # OpenRouter recommends these for free-tier attribution; safe to send.
        "HTTP-Referer":  "https://github.com/Baglan-maker/orleu",
        "X-Title":       settings.APP_NAME,
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": 0.7,
        "max_tokens":  120,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(_OPENROUTER_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected OpenRouter response shape: {data!r}") from e

    text = (text or "").strip().strip('"').strip("'")
    if not text:
        raise RuntimeError("OpenRouter returned empty content")
    return text


def generate_coach_message(
    trend:       str,
    confidence:  float,
    shap_values: dict[str, float],
    user_context: dict,
) -> str:
    """
    Try the primary model, fall back to the secondary on any failure.
    Raises if both fail — caller falls back to hardcoded templates.
    """
    system = _SYSTEM_PROMPT
    user   = _build_user_prompt(trend, confidence, shap_values, user_context)

    try:
        return _call_openrouter(
            settings.OPENROUTER_PRIMARY_MODEL, system, user, settings.OPENROUTER_TIMEOUT_S,
        )
    except Exception as e:
        logger.warning("LLM primary model failed (%s): %s", settings.OPENROUTER_PRIMARY_MODEL, e)

    return _call_openrouter(
        settings.OPENROUTER_FALLBACK_MODEL, system, user, settings.OPENROUTER_TIMEOUT_S,
    )
