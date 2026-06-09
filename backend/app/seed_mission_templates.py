"""
python -m app.seed_mission_templates
Run once after alembic upgrade head.
Creates mission templates for the adaptive mission system.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app.db.database import SessionLocal
from app.models import MissionTemplate

TEMPLATES = [
    # ── Volume missions (Doc §5: "volume") ──
    {
        "name": "Volume Crusher",
        "type": "total_reps",
        "description_template": "Complete {target} total reps this week",
        "base_target": 350,
        "difficulty_scale": 1.15,
        "base_xp": 150,
        "base_coins": 30,
        "duration_days": 7,
        "trend_focus": "improving",
    },
    {
        "name": "Tonnage King",
        "type": "total_volume",
        "description_template": "Lift {target} kg total volume this week",
        "base_target": 5000,
        "difficulty_scale": 1.1,
        "base_xp": 180,
        "base_coins": 35,
        "duration_days": 7,
        "trend_focus": "improving",
    },
    # ── Consistency missions (Doc §5: "consistency") ──
    {
        "name": "Weekly Warrior",
        "type": "workout_count",
        "description_template": "Train {target} sessions this week",
        "base_target": 4,
        "difficulty_scale": 1.0,
        "base_xp": 100,
        "base_coins": 20,
        "duration_days": 7,
    },
    {
        "name": "Comeback Session",
        "type": "workout_count",
        "description_template": "Log any {target} workout this week",
        "base_target": 1,
        "difficulty_scale": 1.0,
        "base_xp": 80,
        "base_coins": 15,
        "duration_days": 7,
        "trend_focus": "declining",
    },
    # ── Intensity / muscle-specific missions (Doc §5: "intensity") ──
    {
        "name": "Chest Day Champion",
        "type": "muscle_sets",
        "description_template": "Complete {target} chest sets this week",
        "base_target": 16,
        "difficulty_scale": 1.1,
        "base_xp": 120,
        "base_coins": 25,
        "duration_days": 7,
        "campaign_path_filter": "A",
    },
    {
        "name": "Back Builder",
        "type": "muscle_sets",
        "description_template": "Complete {target} back sets this week",
        "base_target": 16,
        "difficulty_scale": 1.1,
        "base_xp": 120,
        "base_coins": 25,
        "duration_days": 7,
    },
    {
        "name": "Leg Day Legend",
        "type": "muscle_sets",
        "description_template": "Complete {target} leg sets this week",
        "base_target": 12,
        "difficulty_scale": 1.1,
        "base_xp": 130,
        "base_coins": 25,
        "duration_days": 7,
    },
    # ── Variety missions (Doc §5: "variety") ──
    {
        "name": "Exercise Explorer",
        "type": "unique_exercises",
        "description_template": "Use {target} different exercises this week",
        "base_target": 8,
        "difficulty_scale": 1.0,
        "base_xp": 110,
        "base_coins": 22,
        "duration_days": 7,
        "campaign_path_filter": "B",
        "trend_focus": "plateau",
    },
    # ── Additional endurance/variety missions ──
    # "Movement Variety" fills the gap for path-A users who chose endurance:
    # Exercise Explorer is path-B locked, leaving them with zero variety missions.
    {
        "name": "Movement Variety",
        "type": "unique_exercises",
        "description_template": "Use {target} different exercises this week",
        "base_target": 8,
        "difficulty_scale": 1.0,
        "base_xp": 110,
        "base_coins": 22,
        "duration_days": 7,
        "trend_focus": "plateau",
    },
    # "Endurance Block" bridges the gap between Comeback (1 session) and
    # Weekly Warrior (4 sessions/7 days) for endurance-goal users.
    {
        "name": "Endurance Block",
        "type": "workout_count",
        "description_template": "Complete {target} training sessions over 2 weeks",
        "base_target": 3,
        "difficulty_scale": 1.0,
        "base_xp": 95,
        "base_coins": 18,
        "duration_days": 14,
        "trend_focus": "declining",
    },
    # ── Trend-specific missions (surfaced first when the user is in that state) ──
    {
        "name": "Power Surge",
        "type": "total_volume",
        "description_template": "Lift {target} kg total volume this week",
        "base_target": 6000,
        "difficulty_scale": 1.0,
        "base_xp": 200,
        "base_coins": 40,
        "duration_days": 7,
        "trend_focus": "improving",
    },
    {
        "name": "Wake-Up Call",
        "type": "muscle_sets",
        "description_template": "Complete {target} shoulder sets this week",
        "base_target": 14,
        "difficulty_scale": 1.0,
        "base_xp": 120,
        "base_coins": 25,
        "duration_days": 7,
        "trend_focus": "plateau",
    },
    {
        "name": "Just Show Up",
        "type": "workout_count",
        "description_template": "Log {target} workouts this week",
        "base_target": 2,
        "difficulty_scale": 1.0,
        "base_xp": 80,
        "base_coins": 15,
        "duration_days": 7,
        "trend_focus": "declining",
    },
]


def seed():
    db = SessionLocal()
    try:
        added = skipped = 0
        for data in TEMPLATES:
            exists = db.query(MissionTemplate).filter(
                MissionTemplate.name == data["name"]
            ).first()
            if exists:
                skipped += 1
                continue
            db.add(MissionTemplate(
                name=data["name"],
                type=data["type"],
                description_template=data["description_template"],
                base_target=data["base_target"],
                difficulty_scale=data.get("difficulty_scale", 1.0),
                base_xp=data["base_xp"],
                base_coins=data["base_coins"],
                campaign_path_filter=data.get("campaign_path_filter"),
                duration_days=data.get("duration_days", 7),
                trend_focus=data.get("trend_focus"),
            ))
            added += 1
        db.commit()
        print(f"Mission templates: added {added}, skipped {skipped}")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
