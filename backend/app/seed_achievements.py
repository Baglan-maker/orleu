# app/seed_achievements.py
"""Seed default achievements into the database."""

from app.db.database import SessionLocal
from app.models import Achievement

ACHIEVEMENTS = [
    # streak_days
    {"name": "On Fire",           "description": "Maintain a 3-day workout streak",       "icon_key": "streak_3",   "condition_type": "streak_days",        "condition_value": 3},
    {"name": "Week Warrior",      "description": "Maintain a 7-day workout streak",       "icon_key": "streak_7",   "condition_type": "streak_days",        "condition_value": 7},
    {"name": "Unstoppable",       "description": "Maintain a 14-day workout streak",      "icon_key": "streak_14",  "condition_type": "streak_days",        "condition_value": 14},
    {"name": "Iron Will",         "description": "Maintain a 30-day workout streak",      "icon_key": "streak_30",  "condition_type": "streak_days",        "condition_value": 30},

    # total_sessions
    {"name": "First Step",        "description": "Complete your first workout",            "icon_key": "session_1",  "condition_type": "total_sessions",     "condition_value": 1},
    {"name": "Getting Serious",   "description": "Complete 10 workouts",                   "icon_key": "session_10", "condition_type": "total_sessions",     "condition_value": 10},
    {"name": "Dedicated",         "description": "Complete 25 workouts",                   "icon_key": "session_25", "condition_type": "total_sessions",     "condition_value": 25},
    {"name": "Centurion",         "description": "Complete 100 workouts",                  "icon_key": "session_100","condition_type": "total_sessions",     "condition_value": 100},

    # missions_completed
    {"name": "Mission Accepted",  "description": "Complete your first mission",            "icon_key": "mission_1",  "condition_type": "missions_completed", "condition_value": 1},
    {"name": "Mission Master",    "description": "Complete 10 missions",                   "icon_key": "mission_10", "condition_type": "missions_completed", "condition_value": 10},
    {"name": "Overachiever",      "description": "Complete 25 missions",                   "icon_key": "mission_25", "condition_type": "missions_completed", "condition_value": 25},
]


def seed():
    db = SessionLocal()
    try:
        existing = {a.name for a in db.query(Achievement.name).all()}
        added = 0
        for data in ACHIEVEMENTS:
            if data["name"] not in existing:
                db.add(Achievement(**data))
                added += 1
        db.commit()
        print(f"Seeded {added} achievements ({len(existing)} already existed)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
