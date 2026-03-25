"""
python app/seed_food_items.py
Run once after alembic upgrade head.
Inserts 60+ common foods with accurate macros per 100g.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app.db.database import SessionLocal
from app.models.nutrition import FoodItem

# name, brand, calories_per100g, protein_per100g, carbs_per100g, fat_per100g
FOODS = [
    # ── Proteins ─────────────────────────────────────────────────────────────
    ("Chicken Breast (cooked)",  None,           165.0, 31.0,  0.0,  3.6),
    ("Ground Beef 80/20",        None,           254.0, 17.2,  0.0, 20.0),
    ("Whole Egg",                None,           155.0, 13.0,  1.1, 11.0),
    ("Egg White",                None,            52.0, 11.0,  0.7,  0.2),
    ("Tuna (canned in water)",   None,           116.0, 25.5,  0.0,  0.8),
    ("Salmon (Atlantic)",        None,           208.0, 20.0,  0.0, 13.4),
    ("Whey Protein Powder",      None,           370.0, 80.0,  7.5,  3.0),
    ("Cottage Cheese (low fat)", None,            72.0, 12.4,  3.4,  1.0),
    ("Greek Yogurt (plain)",     None,            59.0, 10.0,  3.6,  0.4),
    ("Turkey Breast (cooked)",   None,           189.0, 29.0,  0.0,  7.4),
    ("Tofu (firm)",              None,            76.0,  8.0,  1.9,  4.8),
    ("Lentils (cooked)",         None,           116.0,  9.0, 20.1,  0.4),
    ("Shrimp (cooked)",          None,            99.0, 24.0,  0.0,  0.3),
    ("Tilapia (cooked)",         None,           128.0, 26.0,  0.0,  2.7),
    ("Pork Tenderloin (cooked)", None,           143.0, 26.0,  0.0,  3.5),

    # ── Carbohydrates ─────────────────────────────────────────────────────────
    ("White Rice (cooked)",      None,           130.0,  2.7, 28.2,  0.3),
    ("Brown Rice (cooked)",      None,           123.0,  2.6, 25.6,  1.0),
    ("Oats (dry)",               None,           389.0, 17.0, 66.3,  7.0),
    ("White Bread",              None,           265.0,  9.0, 49.0,  3.2),
    ("Whole Wheat Bread",        None,           247.0, 13.0, 41.0,  3.4),
    ("Pasta (cooked)",           None,           158.0,  5.8, 30.9,  0.9),
    ("White Potato (boiled)",    None,            87.0,  1.9, 20.1,  0.1),
    ("Sweet Potato (boiled)",    None,            76.0,  1.4, 17.7,  0.1),
    ("Banana",                   None,            89.0,  1.1, 22.8,  0.3),
    ("Apple",                    None,            52.0,  0.3, 13.8,  0.2),
    ("Orange",                   None,            47.0,  0.9, 11.8,  0.1),
    ("Grapes",                   None,            69.0,  0.7, 18.1,  0.2),
    ("Blueberries",              None,            57.0,  0.7, 14.5,  0.3),
    ("White Tortilla (flour)",   None,           312.0,  8.0, 51.0,  7.3),
    ("Corn (cooked)",            None,            96.0,  3.4, 21.0,  1.5),

    # ── Fats ──────────────────────────────────────────────────────────────────
    ("Peanut Butter",            None,           588.0, 25.0, 20.0, 50.0),
    ("Almond Butter",            None,           614.0, 21.0, 19.0, 56.0),
    ("Olive Oil",                None,           884.0,  0.0,  0.0,100.0),
    ("Almonds",                  None,           579.0, 21.2, 21.7, 49.9),
    ("Walnuts",                  None,           654.0, 15.2, 13.7, 65.2),
    ("Avocado",                  None,           160.0,  2.0,  8.5, 14.7),
    ("Cheddar Cheese",           None,           403.0, 25.0,  1.3, 33.0),
    ("Whole Milk",               None,            61.0,  3.2,  4.8,  3.3),
    ("Butter",                   None,           717.0,  0.9,  0.1, 81.1),
    ("Coconut Oil",              None,           862.0,  0.0,  0.0,100.0),

    # ── Vegetables ────────────────────────────────────────────────────────────
    ("Broccoli (cooked)",        None,            35.0,  2.4,  7.2,  0.4),
    ("Spinach (raw)",            None,            23.0,  2.9,  3.6,  0.4),
    ("Cucumber",                 None,            16.0,  0.7,  3.6,  0.1),
    ("Tomato",                   None,            18.0,  0.9,  3.9,  0.2),
    ("Bell Pepper (red)",        None,            31.0,  1.0,  6.0,  0.3),
    ("Carrot",                   None,            41.0,  0.9,  9.6,  0.2),
    ("Cauliflower",              None,            25.0,  1.9,  5.0,  0.3),
    ("Kale (raw)",               None,            49.0,  4.3,  8.8,  0.9),
    ("Asparagus",                None,            20.0,  2.2,  3.9,  0.1),
    ("Green Beans",              None,            31.0,  1.8,  7.1,  0.1),

    # ── Dairy / Other ─────────────────────────────────────────────────────────
    ("Mozzarella Cheese",        None,           280.0, 28.0,  2.2, 17.0),
    ("Cream Cheese",             None,           342.0,  6.0,  4.1, 34.0),
    ("Protein Bar",              None,           390.0, 30.0, 40.0, 12.0),

    # ── Fast food proxies ─────────────────────────────────────────────────────
    ("Burger Patty (beef)",      None,           295.0, 17.0,  0.0, 25.0),
    ("Pizza Slice (cheese)",     None,           266.0, 11.4, 32.9,  9.8),
    ("French Fries",             None,           312.0,  3.4, 41.4, 15.0),
    ("Hot Dog (frank only)",     None,           290.0, 11.0,  3.0, 26.0),
    ("Chicken Nuggets",          None,           296.0, 15.0, 17.0, 19.0),
    ("Instant Oatmeal",          None,           379.0, 13.0, 68.0,  6.5),
    ("Granola Bar",              None,           471.0,  8.0, 64.0, 20.0),
    ("Protein Shake (mixed)",    None,           100.0, 20.0,  5.0,  1.5),
]


def run():
    db = SessionLocal()
    added = 0
    skipped = 0
    try:
        for row in FOODS:
            name = row[0]
            existing = db.query(FoodItem).filter_by(name=name, is_custom=False).first()
            if existing:
                skipped += 1
                continue
            item = FoodItem(
                name=name,
                brand=row[1],
                calories_per100g=row[2],
                protein_per100g=row[3],
                carbs_per100g=row[4],
                fat_per100g=row[5],
                is_custom=False,
                created_by=None,
            )
            db.add(item)
            added += 1
        db.commit()
        print(f"Done. Added: {added}, Skipped (already exist): {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
