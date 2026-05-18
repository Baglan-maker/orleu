"""
Cleanup script: deletes today's ml_predictions and their associated coach_messages.
Use this AFTER running test_ml_e2e.py — that test mocked build_features and
left fake predictions in the DB.
After running this, kick off the real nightly job (POST /api/debug/run-ml)
to regenerate predictions from real user data.
"""
from datetime import date

from app.db.database import SessionLocal
from app.models.ml import CoachMessage, MlPrediction


def main() -> None:
    db = SessionLocal()
    try:
        today = date.today()
        # Delete coach messages tied to today's predictions first (FK constraint)
        pred_ids = [
            row.id for row in
            db.query(MlPrediction).filter(MlPrediction.prediction_date == today).all()
        ]
        if not pred_ids:
            print("No predictions for today. Nothing to clean.")
            return

        msg_count = (
            db.query(CoachMessage)
            .filter(CoachMessage.prediction_id.in_(pred_ids))
            .delete(synchronize_session=False)
        )
        pred_count = (
            db.query(MlPrediction)
            .filter(MlPrediction.id.in_(pred_ids))
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"Deleted {pred_count} predictions and {msg_count} coach messages.")
        print("Now run: POST /api/debug/run-ml  to regenerate from real data.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
