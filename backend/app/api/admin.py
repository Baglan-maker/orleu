"""
Admin dashboard — single-page HTML at GET /admin/ml-health.

Pulls everything from existing tables (ml_predictions, coach_messages, users,
workouts). No new tables, no extra writes in the hot path. Auth is HTTP Basic
using ADMIN_USERNAME / ADMIN_PASSWORD from settings; if either is empty,
the route returns 503 (the dashboard is intentionally off).

LLM-vs-template detection is a heuristic: a coach message is counted as
"LLM-generated" iff its text does NOT exactly match any of the 30 hardcoded
template strings in coach_service._TEMPLATES.
"""
from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta, timezone
from html import escape

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.auth import User
from app.models.ml import CoachMessage, MlPrediction
from app.models.workout import Workout
from app.services.coach_service import _TEMPLATES

router = APIRouter()

_security = HTTPBasic()


def _check_admin(credentials: HTTPBasicCredentials = Depends(_security)) -> None:
    if not settings.ADMIN_USERNAME or not settings.ADMIN_PASSWORD:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Admin disabled")
    # secrets.compare_digest avoids timing leaks
    user_ok = secrets.compare_digest(credentials.username, settings.ADMIN_USERNAME)
    pass_ok = secrets.compare_digest(credentials.password, settings.ADMIN_PASSWORD)
    if not (user_ok and pass_ok):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )


def _flat_templates() -> set[str]:
    """All 30 template strings, flattened for O(1) membership test."""
    return {
        text
        for trend_map in _TEMPLATES.values()
        for variants  in trend_map.values()
        for text      in variants
    }


def _collect_stats(db: Session) -> dict:
    now    = datetime.now(timezone.utc)
    today  = date.today()
    cutoff = now - timedelta(days=14)
    week_ago = today - timedelta(days=7)

    # ── Eligibility funnel ─────────────────────────────────────────────────────
    total_users = db.query(func.count(User.id)).scalar() or 0

    past_cutoff = (
        db.query(func.count(User.id))
        .filter(User.created_at < cutoff)
        .scalar() or 0
    )

    # Users past cutoff WITH ≥3 workouts — second filter from nightly_ml.py
    eligible_q = (
        db.query(User.id)
        .outerjoin(Workout, Workout.user_id == User.id)
        .filter(User.created_at < cutoff)
        .group_by(User.id)
        .having(func.count(Workout.id) >= 3)
    )
    eligible = eligible_q.count()

    # ── Predictions over last 7 days ───────────────────────────────────────────
    preds_7d = (
        db.query(MlPrediction)
        .filter(MlPrediction.prediction_date >= week_ago)
        .all()
    )

    by_trend: dict[str, list[float]] = {"improving": [], "plateau": [], "declining": []}
    for p in preds_7d:
        if p.trend in by_trend:
            by_trend[p.trend].append(float(p.confidence or 0.0))

    total_preds_7d = len(preds_7d)
    avg_conf_overall = (
        sum(c for arr in by_trend.values() for c in arr) / total_preds_7d
        if total_preds_7d else 0.0
    )

    # Today only
    preds_today = sum(1 for p in preds_7d if p.prediction_date == today)

    # ── Model info ─────────────────────────────────────────────────────────────
    latest = (
        db.query(MlPrediction.model_version, func.max(MlPrediction.created_at))
        .group_by(MlPrediction.model_version)
        .order_by(func.max(MlPrediction.created_at).desc())
        .first()
    )
    model_version  = latest[0] if latest else "—"
    last_predicted = latest[1] if latest else None

    # ── Coach messages: LLM vs template ───────────────────────────────────────
    templates_set = _flat_templates()
    msgs_7d = (
        db.query(CoachMessage)
        .filter(CoachMessage.created_at >= now - timedelta(days=7))
        .all()
    )
    total_msgs = len(msgs_7d)
    template_msgs = sum(1 for m in msgs_7d if m.message_text in templates_set)
    llm_msgs = total_msgs - template_msgs

    # ── Recent messages (10 latest) for sanity-check ──────────────────────────
    recent = (
        db.query(CoachMessage, MlPrediction)
        .join(MlPrediction, MlPrediction.id == CoachMessage.prediction_id)
        .order_by(CoachMessage.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "now":              now,
        "model_version":    model_version,
        "last_predicted":   last_predicted,
        "total_users":      total_users,
        "past_cutoff":      past_cutoff,
        "eligible":         eligible,
        "preds_today":      preds_today,
        "total_preds_7d":   total_preds_7d,
        "by_trend":         by_trend,
        "avg_conf_overall": avg_conf_overall,
        "total_msgs":       total_msgs,
        "llm_msgs":         llm_msgs,
        "template_msgs":    template_msgs,
        "recent":           recent,
        "primary_model":    settings.OPENROUTER_PRIMARY_MODEL,
        "fallback_model":   settings.OPENROUTER_FALLBACK_MODEL,
        "llm_key_set":      bool(settings.OPENROUTER_API_KEY),
    }


def _bar(pct: float, color: str) -> str:
    pct = max(0.0, min(100.0, pct))
    return (
        f'<div class="bar"><div class="fill" '
        f'style="width:{pct:.1f}%;background:{color};"></div></div>'
    )


def _render(stats: dict) -> str:
    s = stats
    trend_colors = {"improving": "#2eaf6e", "plateau": "#888", "declining": "#d97a2a"}

    # Per-trend bars
    trend_rows = []
    for trend in ("improving", "plateau", "declining"):
        confs = s["by_trend"][trend]
        n     = len(confs)
        pct   = (n / s["total_preds_7d"] * 100) if s["total_preds_7d"] else 0.0
        avg   = (sum(confs) / n) if n else 0.0
        trend_rows.append(
            f'<tr>'
            f'  <td><span class="dot" style="background:{trend_colors[trend]}"></span>{trend}</td>'
            f'  <td>{n}</td>'
            f'  <td>{pct:.1f}%</td>'
            f'  <td>{avg:.3f}</td>'
            f'  <td>{_bar(pct, trend_colors[trend])}</td>'
            f'</tr>'
        )

    # LLM vs template
    llm_pct = (s["llm_msgs"] / s["total_msgs"] * 100) if s["total_msgs"] else 0.0
    tpl_pct = 100.0 - llm_pct if s["total_msgs"] else 0.0

    # Recent messages list
    recent_html = []
    for cm, p in s["recent"]:
        is_tpl = cm.message_text in _flat_templates()
        badge  = ('<span class="badge tpl">TEMPLATE</span>'
                  if is_tpl else '<span class="badge llm">LLM</span>')
        recent_html.append(
            f'<div class="msg">'
            f'  <div class="meta">'
            f'    {badge} <code>{escape(p.trend)}</code> '
            f'    conf={float(p.confidence or 0):.2f} · '
            f'    {cm.created_at.strftime("%Y-%m-%d %H:%M")}'
            f'  </div>'
            f'  <div class="text">{escape(cm.message_text)}</div>'
            f'</div>'
        )

    last_pred_str = (
        s["last_predicted"].strftime("%Y-%m-%d %H:%M UTC")
        if s["last_predicted"] else "—"
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Orleu · ML Health</title>
  <style>
    :root {{ color-scheme: light; }}
    * {{ box-sizing: border-box; }}
    body {{
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0; padding: 24px; background: #f6f7f9; color: #1c1c1e;
      max-width: 1100px; margin-left: auto; margin-right: auto;
    }}
    h1 {{ margin: 0 0 4px; font-size: 22px; }}
    .sub {{ color: #666; font-size: 12px; margin-bottom: 24px; }}
    .grid {{ display: grid; gap: 16px; grid-template-columns: repeat(4, 1fr); margin-bottom: 24px; }}
    .card {{ background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }}
    .card .label {{ color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }}
    .card .value {{ font-size: 26px; font-weight: 600; margin-top: 4px; }}
    .card .hint  {{ color: #888; font-size: 11px; margin-top: 4px; }}
    section {{ background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 16px; }}
    section h2 {{ font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin: 0 0 12px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }}
    th {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #888; font-weight: 600; }}
    .dot {{ display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }}
    .bar {{ background: #eee; border-radius: 4px; height: 8px; width: 160px; overflow: hidden; }}
    .bar .fill {{ height: 100%; transition: width .3s; }}
    .funnel-row {{ display: flex; gap: 12px; align-items: center; margin: 6px 0; }}
    .funnel-row .lbl {{ width: 220px; font-size: 12px; color: #555; }}
    .funnel-row .val {{ width: 50px; font-weight: 600; font-size: 13px; }}
    .funnel-bar {{ flex: 1; height: 10px; background: #eee; border-radius: 5px; overflow: hidden; }}
    .funnel-bar .ff {{ height: 100%; background: #4a90e2; }}
    .msg {{ padding: 10px 0; border-bottom: 1px solid #eee; }}
    .msg:last-child {{ border-bottom: none; }}
    .meta {{ font-size: 11px; color: #888; margin-bottom: 4px; }}
    .text {{ font-size: 13px; }}
    .badge {{
      display: inline-block; padding: 1px 6px; font-size: 10px; border-radius: 4px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px;
    }}
    .badge.llm {{ background: #e3f1ff; color: #1858a0; }}
    .badge.tpl {{ background: #f0e5ff; color: #6b3aa0; }}
    code {{ background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 12px; }}
    .warn {{ color: #b04a18; }}
  </style>
</head>
<body>
  <h1>ML Health</h1>
  <div class="sub">
    Generated {s['now'].strftime('%Y-%m-%d %H:%M:%S UTC')}
    · model <code>{escape(s['model_version'])}</code>
    · last prediction {last_pred_str}
  </div>

  <!-- KPI cards -->
  <div class="grid">
    <div class="card">
      <div class="label">Predictions today</div>
      <div class="value">{s['preds_today']}</div>
      <div class="hint">{s['eligible']} users currently eligible</div>
    </div>
    <div class="card">
      <div class="label">Predictions · 7d</div>
      <div class="value">{s['total_preds_7d']}</div>
      <div class="hint">avg confidence {s['avg_conf_overall']:.3f}</div>
    </div>
    <div class="card">
      <div class="label">Coach messages · 7d</div>
      <div class="value">{s['total_msgs']}</div>
      <div class="hint">{s['llm_msgs']} LLM · {s['template_msgs']} template</div>
    </div>
    <div class="card">
      <div class="label">LLM share · 7d</div>
      <div class="value">{llm_pct:.0f}%</div>
      <div class="hint">{'API key set' if s['llm_key_set'] else '<span class="warn">no API key</span>'}</div>
    </div>
  </div>

  <!-- Eligibility funnel -->
  <section>
    <h2>Eligibility funnel</h2>
    <div class="funnel-row">
      <div class="lbl">Total users</div>
      <div class="val">{s['total_users']}</div>
      <div class="funnel-bar"><div class="ff" style="width:100%"></div></div>
    </div>
    <div class="funnel-row">
      <div class="lbl">Past 14-day cutoff</div>
      <div class="val">{s['past_cutoff']}</div>
      <div class="funnel-bar"><div class="ff" style="width:{(s['past_cutoff']/s['total_users']*100) if s['total_users'] else 0:.1f}%"></div></div>
    </div>
    <div class="funnel-row">
      <div class="lbl">+ at least 3 workouts</div>
      <div class="val">{s['eligible']}</div>
      <div class="funnel-bar"><div class="ff" style="width:{(s['eligible']/s['total_users']*100) if s['total_users'] else 0:.1f}%"></div></div>
    </div>
    <div class="funnel-row">
      <div class="lbl">Predicted today</div>
      <div class="val">{s['preds_today']}</div>
      <div class="funnel-bar"><div class="ff" style="width:{(s['preds_today']/s['total_users']*100) if s['total_users'] else 0:.1f}%"></div></div>
    </div>
  </section>

  <!-- Trend distribution -->
  <section>
    <h2>Trend distribution (last 7 days)</h2>
    <table>
      <thead><tr><th>Trend</th><th>Count</th><th>Share</th><th>Avg confidence</th><th></th></tr></thead>
      <tbody>{''.join(trend_rows)}</tbody>
    </table>
  </section>

  <!-- LLM vs template -->
  <section>
    <h2>Coach message source · last 7 days</h2>
    <p style="margin: 0 0 12px; font-size: 12px; color: #666;">
      LLM via <code>{escape(s['primary_model'])}</code>
      → fallback <code>{escape(s['fallback_model'])}</code>
      → 30 hardcoded templates.
      Detection: message text matches a template string exactly ⇒ template; otherwise ⇒ LLM.
    </p>
    <table>
      <tbody>
        <tr>
          <td style="width:120px"><span class="badge llm">LLM</span></td>
          <td style="width:60px">{s['llm_msgs']}</td>
          <td style="width:60px">{llm_pct:.1f}%</td>
          <td>{_bar(llm_pct, '#4a90e2')}</td>
        </tr>
        <tr>
          <td><span class="badge tpl">Template</span></td>
          <td>{s['template_msgs']}</td>
          <td>{tpl_pct:.1f}%</td>
          <td>{_bar(tpl_pct, '#a07bd1')}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Recent messages -->
  <section>
    <h2>10 most recent coach messages</h2>
    {''.join(recent_html) or '<em style="color:#888">No messages yet — run nightly_ml first.</em>'}
  </section>

  <div class="sub" style="text-align:center; margin-top: 32px;">
    Orleu admin dashboard · /admin/ml-health
  </div>
</body>
</html>"""


@router.get("/ml-health", response_class=HTMLResponse, include_in_schema=False)
def ml_health(
    _:  None    = Depends(_check_admin),
    db: Session = Depends(get_db),
):
    """Single-page dashboard summarising ML + LLM coach state. Admin-only."""
    return _render(_collect_stats(db))
