"""
python -m app.seed_campaigns
Run once after alembic upgrade head.
Creates 2 campaigns with chapters.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app.db.database import SessionLocal
from app.models import Campaign, CampaignChapter

CAMPAIGNS = [
    {
        "name": "The Foundation",
        "description": "Your first path in the gym. Build a foundation of strength and training habits.",
        "order_index": 1,
        "chapters": [
            {
                "chapter_number": 1,
                "title": "First Steps",
                "narrative_text": "Every ascent begins with the first step. You came to the gym — that's already a victory.",
            },
            {
                "chapter_number": 2,
                "title": "Building Habits",
                "narrative_text": "Consistency is more important than intensity. Three workouts a week — and your body will start to change.",
            },
            {
                "chapter_number": 3,
                "title": "The Crossroads",
                "narrative_text": "You've grown stronger. Ahead lies a fork: strength or endurance?",
                "has_branch": True,
                "branch_a_label": "Power Path",
                "branch_b_label": "Endurance Path",
            },
            {
                "chapter_number": 4,
                "title": "Momentum",
                "narrative_text": "You've chosen your path. Now — build momentum. Every workout brings you closer to your goal.",
            },
            {
                "chapter_number": 5,
                "title": "The Ascent",
                "narrative_text": "The foundation is laid. You're no longer a novice — you're an athlete. New peaks await.",
            },
        ],
    },
    {
        "name": "Iron Chronicles",
        "description": "For those who already know the taste of iron. Time to reach a new level.",
        "order_index": 2,
        "chapters": [
            {
                "chapter_number": 1,
                "title": "Return to Iron",
                "narrative_text": "The gym remembers you. Time to return to the barbell and show what you're capable of.",
            },
            {
                "chapter_number": 2,
                "title": "Pushing Limits",
                "narrative_text": "The comfort zone is the enemy of progress. Add weight, add reps.",
            },
            {
                "chapter_number": 3,
                "title": "The Fork",
                "narrative_text": "Two paths to the peak: maximum strength or volume training.",
                "has_branch": True,
                "branch_a_label": "Strength Focus",
                "branch_b_label": "Volume Focus",
            },
            {
                "chapter_number": 4,
                "title": "Mastery",
                "narrative_text": "Technique, control, progression. Mastery is patience and discipline.",
            },
            {
                "chapter_number": 5,
                "title": "Peak Form",
                "narrative_text": "You're at your peak. Everything you did — brought you here. Legends don't stop.",
            },
        ],
    },
]


def seed():
    db = SessionLocal()
    try:
        added_c = skipped_c = 0
        added_ch = 0

        for data in CAMPAIGNS:
            existing = db.query(Campaign).filter(Campaign.name == data["name"]).first()
            if existing:
                skipped_c += 1
                continue

            campaign = Campaign(
                name=data["name"],
                description=data["description"],
                total_chapters=len(data["chapters"]),
                order_index=data["order_index"],
                is_active=True,
            )
            db.add(campaign)
            db.flush()

            for ch in data["chapters"]:
                db.add(CampaignChapter(
                    campaign_id=campaign.id,
                    chapter_number=ch["chapter_number"],
                    title=ch["title"],
                    narrative_text=ch.get("narrative_text"),
                    has_branch=ch.get("has_branch", False),
                    branch_a_label=ch.get("branch_a_label"),
                    branch_b_label=ch.get("branch_b_label"),
                ))
                added_ch += 1

            added_c += 1

        db.commit()
        print(f"✅  Кампании: добавлено {added_c}, пропущено {skipped_c}")
        print(f"✅  Главы: добавлено {added_ch}")
    except Exception as e:
        db.rollback()
        print(f"❌  Ошибка: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
