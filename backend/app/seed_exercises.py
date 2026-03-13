"""
python seed_exercises.py
Запускать один раз после alembic upgrade head.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models import ExerciseLibrary

EXERCISES = [
    # Chest
    {"name": "Barbell Bench Press",     "alias": "Bench Press",    "muscle_group": "chest",     "category": "compound"},
    {"name": "Incline Barbell Press",   "alias": "Incline Press",  "muscle_group": "chest",     "category": "compound"},
    {"name": "Dumbbell Bench Press",    "alias": "DB Bench",       "muscle_group": "chest",     "category": "compound"},
    {"name": "Cable Chest Fly",         "alias": "Cable Fly",      "muscle_group": "chest",     "category": "isolation"},
    {"name": "Push-up",                 "alias": "Pushup",         "muscle_group": "chest",     "category": "bodyweight"},
    # Back
    {"name": "Barbell Deadlift",        "alias": "Deadlift",       "muscle_group": "back",      "category": "compound"},
    {"name": "Pull-up",                 "alias": "Pullup",         "muscle_group": "back",      "category": "bodyweight"},
    {"name": "Barbell Row",             "alias": "Bent-Over Row",  "muscle_group": "back",      "category": "compound"},
    {"name": "Seated Cable Row",        "alias": "Cable Row",      "muscle_group": "back",      "category": "compound"},
    {"name": "Lat Pulldown",            "alias": None,             "muscle_group": "back",      "category": "compound"},
    {"name": "T-Bar Row",               "alias": None,             "muscle_group": "back",      "category": "compound"},
    {"name": "Single-Arm Dumbbell Row", "alias": "DB Row",         "muscle_group": "back",      "category": "compound"},
    # Shoulders
    {"name": "Overhead Press",          "alias": "OHP",            "muscle_group": "shoulders", "category": "compound"},
    {"name": "Dumbbell Shoulder Press", "alias": "DB OHP",         "muscle_group": "shoulders", "category": "compound"},
    {"name": "Dumbbell Lateral Raise",  "alias": "Lateral Raise",  "muscle_group": "shoulders", "category": "isolation"},
    {"name": "Face Pull",               "alias": None,             "muscle_group": "shoulders", "category": "isolation"},
    {"name": "Rear Delt Fly",           "alias": None,             "muscle_group": "shoulders", "category": "isolation"},
    # Arms
    {"name": "Barbell Curl",            "alias": "BB Curl",        "muscle_group": "arms",      "category": "isolation"},
    {"name": "Dumbbell Curl",           "alias": "DB Curl",        "muscle_group": "arms",      "category": "isolation"},
    {"name": "Hammer Curl",             "alias": None,             "muscle_group": "arms",      "category": "isolation"},
    {"name": "Tricep Pushdown",         "alias": "Cable Pushdown", "muscle_group": "arms",      "category": "isolation"},
    {"name": "Skull Crusher",           "alias": "EZ Bar Tricep",  "muscle_group": "arms",      "category": "isolation"},
    {"name": "Close-Grip Bench Press",  "alias": "CGBP",           "muscle_group": "arms",      "category": "compound"},
    {"name": "Dips",                    "alias": "Tricep Dips",    "muscle_group": "arms",      "category": "bodyweight"},
    # Legs
    {"name": "Barbell Back Squat",      "alias": "Squat",          "muscle_group": "legs",      "category": "compound"},
    {"name": "Romanian Deadlift",       "alias": "RDL",            "muscle_group": "legs",      "category": "compound"},
    {"name": "Leg Press",               "alias": None,             "muscle_group": "legs",      "category": "compound"},
    {"name": "Bulgarian Split Squat",   "alias": "BSS",            "muscle_group": "legs",      "category": "compound"},
    {"name": "Leg Curl",                "alias": "Hamstring Curl", "muscle_group": "legs",      "category": "isolation"},
    {"name": "Leg Extension",           "alias": None,             "muscle_group": "legs",      "category": "isolation"},
    {"name": "Standing Calf Raise",     "alias": "Calf Raise",     "muscle_group": "legs",      "category": "isolation"},
    {"name": "Lunges",                  "alias": "Walking Lunges", "muscle_group": "legs",      "category": "compound"},
    # Core
    {"name": "Plank",                   "alias": None,             "muscle_group": "core",      "category": "bodyweight"},
    {"name": "Cable Crunch",            "alias": None,             "muscle_group": "core",      "category": "isolation"},
    {"name": "Hanging Leg Raise",       "alias": "HLR",            "muscle_group": "core",      "category": "bodyweight"},
    {"name": "Ab Wheel Rollout",        "alias": "Ab Wheel",       "muscle_group": "core",      "category": "bodyweight"},
    # Cardio / Full body
    {"name": "Running (Treadmill)",     "alias": "Treadmill",      "muscle_group": "full_body", "category": "cardio"},
    {"name": "Rowing Machine",          "alias": "Rowing",         "muscle_group": "full_body", "category": "cardio"},
    {"name": "Kettlebell Swing",        "alias": "KB Swing",       "muscle_group": "full_body", "category": "compound"},
]


def seed():
    db = SessionLocal()
    try:
        added = skipped = 0
        for data in EXERCISES:
            exists = db.query(ExerciseLibrary).filter(
                ExerciseLibrary.name == data["name"],
                ExerciseLibrary.is_custom == False,
            ).first()
            if exists:
                skipped += 1
                continue
            db.add(ExerciseLibrary(
                name=data["name"],
                alias=data.get("alias"),
                muscle_group=data["muscle_group"],
                category=data["category"],
                is_custom=False,
                created_by=None,
            ))
            added += 1
        db.commit()
        print(f"✅  Добавлено: {added}, пропущено: {skipped}")
    except Exception as e:
        db.rollback()
        print(f"❌  Ошибка: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()