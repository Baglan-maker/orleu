"""
python -m app.seed_campaigns
Запускать один раз после alembic upgrade head.
Создаёт 2 кампании с главами.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app.db.database import SessionLocal
from app.models import Campaign, CampaignChapter

CAMPAIGNS = [
    {
        "name": "The Foundation",
        "description": "Твой первый путь в зале. Построй фундамент силы и привычки тренироваться.",
        "order_index": 1,
        "chapters": [
            {
                "chapter_number": 1,
                "title": "First Steps",
                "narrative_text": "Каждое восхождение начинается с первого шага. Ты пришёл в зал — это уже победа.",
            },
            {
                "chapter_number": 2,
                "title": "Building Habits",
                "narrative_text": "Регулярность важнее интенсивности. Три тренировки в неделю — и тело начнёт меняться.",
            },
            {
                "chapter_number": 3,
                "title": "The Crossroads",
                "narrative_text": "Ты окреп. Впереди развилка: сила или выносливость?",
                "has_branch": True,
                "branch_a_label": "Power Path",
                "branch_b_label": "Endurance Path",
            },
            {
                "chapter_number": 4,
                "title": "Momentum",
                "narrative_text": "Ты выбрал свой путь. Теперь — набирай темп. Каждая тренировка приближает к цели.",
            },
            {
                "chapter_number": 5,
                "title": "The Ascent",
                "narrative_text": "Фундамент заложен. Ты уже не новичок — ты атлет. Впереди — новые вершины.",
            },
        ],
    },
    {
        "name": "Iron Chronicles",
        "description": "Для тех, кто уже знает вкус железа. Время выйти на новый уровень.",
        "order_index": 2,
        "chapters": [
            {
                "chapter_number": 1,
                "title": "Return to Iron",
                "narrative_text": "Зал помнит тебя. Пора вернуться к штанге и показать, на что ты способен.",
            },
            {
                "chapter_number": 2,
                "title": "Pushing Limits",
                "narrative_text": "Комфортная зона — враг прогресса. Добавь вес, добавь повторения.",
            },
            {
                "chapter_number": 3,
                "title": "The Fork",
                "narrative_text": "Два пути к вершине: максимальная сила или объёмный тренинг.",
                "has_branch": True,
                "branch_a_label": "Strength Focus",
                "branch_b_label": "Volume Focus",
            },
            {
                "chapter_number": 4,
                "title": "Mastery",
                "narrative_text": "Техника, контроль, прогрессия. Мастерство — это терпение и дисциплина.",
            },
            {
                "chapter_number": 5,
                "title": "Peak Form",
                "narrative_text": "Ты на пике. Всё что ты делал — привело тебя сюда. Легенды не останавливаются.",
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
