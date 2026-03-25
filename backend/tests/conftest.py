"""
Shared fixtures for integration tests.

Uses a file-based SQLite database so tests run without PostgreSQL.
Patches the PostgreSQL UUID type to work with SQLite by using CHAR(36)
and coercing string ↔ uuid.UUID transparently.
"""
import os
import uuid as _uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, String, DateTime
from sqlalchemy.orm import sessionmaker
from sqlalchemy import types as sa_types
import sqlalchemy.dialects.postgresql as pg_dialect


# ---------------------------------------------------------------------------
# Monkey-patch PostgreSQL UUID to be SQLite-friendly
# ---------------------------------------------------------------------------
_OrigUUID = pg_dialect.UUID


class _SQLiteCompatUUID(sa_types.TypeDecorator):
    """A UUID type that stores as CHAR(36) on SQLite and coerces str ↔ uuid."""
    impl = String(36)
    cache_ok = True

    def __init__(self, as_uuid=True, **kw):
        self.as_uuid = as_uuid
        super().__init__()

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if self.as_uuid:
            if isinstance(value, _uuid.UUID):
                return value
            return _uuid.UUID(str(value))
        return str(value)


# Replace the type globally so all models use it
pg_dialect.UUID = _SQLiteCompatUUID  # type: ignore[misc]




# ---------------------------------------------------------------------------
# Set env vars BEFORE importing app modules (they read settings at import)
# ---------------------------------------------------------------------------
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-jwt"
os.environ["APP_ENV"] = "development"

from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    User,
    UserProgress,
    ExerciseLibrary,
    Campaign,
    CampaignChapter,
    MissionTemplate,
    Achievement,
    FoodItem,
)
from app.services.auth_utils import create_access_token, hash_password  # noqa: E402


# ---------------------------------------------------------------------------
# Engine & session factory
# ---------------------------------------------------------------------------
SQLALCHEMY_TEST_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Make naive datetimes loaded from SQLite timezone-aware (UTC)
# ---------------------------------------------------------------------------
from sqlalchemy.orm import InstanceEvents
from sqlalchemy import inspect as sa_inspect


@event.listens_for(TestSessionLocal, "loaded_as_persistent")
def _make_datetimes_tz_aware(session, instance):
    """After loading an ORM object, replace naive datetimes with UTC-aware."""
    mapper = sa_inspect(type(instance))
    for col_attr in mapper.column_attrs:
        col = col_attr.columns[0]
        if isinstance(col.type, (DateTime,)):
            val = getattr(instance, col_attr.key, None)
            if isinstance(val, datetime) and val.tzinfo is None:
                # Use object.__setattr__ to avoid triggering dirty tracking
                object.__setattr__(instance, col_attr.key, val.replace(tzinfo=timezone.utc))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _setup_teardown_tables():
    """Create tables before each test and drop after — full isolation."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Provide a DB session for the test."""
    session = TestSessionLocal()
    yield session
    session.close()


@pytest.fixture()
def client(db):
    """TestClient wired to the per-test DB session."""
    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(db) -> User:
    """Create a test user with UserProgress."""
    user = User(
        id=_uuid.uuid4(),
        email="test@example.com",
        password_hash=hash_password("password123"),
        name="Test User",
        experience_level="beginner",
        primary_goal="strength",
        onboarding_done=False,
    )
    db.add(user)
    db.flush()

    progress = UserProgress(user_id=user.id)
    db.add(progress)
    db.commit()
    return user


@pytest.fixture()
def auth_header(test_user) -> dict:
    """Authorization header for test_user."""
    token = create_access_token(str(test_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def sample_exercises(db) -> list[ExerciseLibrary]:
    """Seed a few system exercises."""
    exercises = [
        ExerciseLibrary(name="Bench Press", alias="bench", muscle_group="chest", category="compound", is_custom=False),
        ExerciseLibrary(name="Squat", alias="squat", muscle_group="legs", category="compound", is_custom=False),
        ExerciseLibrary(name="Deadlift", alias="deadlift", muscle_group="back", category="compound", is_custom=False),
        ExerciseLibrary(name="Bicep Curl", alias="curl", muscle_group="arms", category="isolation", is_custom=False),
        ExerciseLibrary(name="Shoulder Press", alias="ohp", muscle_group="shoulders", category="compound", is_custom=False),
    ]
    db.add_all(exercises)
    db.commit()
    return exercises


@pytest.fixture()
def sample_campaign(db) -> Campaign:
    """Create a campaign with 5 chapters (chapter 3 has a branch)."""
    campaign = Campaign(
        name="Beginner Journey",
        description="Your first steps",
        total_chapters=5,
        order_index=1,
        is_active=True,
    )
    db.add(campaign)
    db.flush()

    chapters_data = [
        {"chapter_number": 1, "title": "First Steps", "has_branch": False},
        {"chapter_number": 2, "title": "Building Habits", "has_branch": False},
        {"chapter_number": 3, "title": "Choose Your Path", "has_branch": True, "branch_a_label": "Strength", "branch_b_label": "Endurance"},
        {"chapter_number": 4, "title": "Deep Training", "has_branch": False},
        {"chapter_number": 5, "title": "Final Challenge", "has_branch": False},
    ]
    for ch_data in chapters_data:
        chapter = CampaignChapter(campaign_id=campaign.id, **ch_data)
        db.add(chapter)
    db.commit()
    return campaign


@pytest.fixture()
def sample_missions(db) -> list[MissionTemplate]:
    """Seed mission templates."""
    templates = [
        MissionTemplate(
            name="Rep Machine",
            type="total_reps",
            description_template="Complete {target} total reps this week",
            base_target=100,
            difficulty_scale=1.1,
            base_xp=50,
            base_coins=20,
            duration_days=7,
        ),
        MissionTemplate(
            name="Volume King",
            type="total_volume",
            description_template="Lift {target} kg total volume",
            base_target=1000,
            difficulty_scale=1.15,
            base_xp=75,
            base_coins=30,
            duration_days=7,
        ),
        MissionTemplate(
            name="Consistent Worker",
            type="workout_count",
            description_template="Complete {target} workouts this week",
            base_target=3,
            difficulty_scale=1.0,
            base_xp=60,
            base_coins=25,
            duration_days=7,
        ),
    ]
    db.add_all(templates)
    db.commit()
    return templates


@pytest.fixture()
def sample_achievements(db) -> list[Achievement]:
    """Seed achievements."""
    achievements = [
        Achievement(name="First Workout", description="Complete your first workout", icon_key="first_workout", condition_type="total_sessions", condition_value=1),
        Achievement(name="3-Day Streak", description="3 consecutive days", icon_key="streak_3", condition_type="streak_days", condition_value=3),
        Achievement(name="5 Workouts", description="Complete 5 workouts", icon_key="five_workouts", condition_type="total_sessions", condition_value=5),
        Achievement(name="Mission Accomplished", description="Complete your first mission", icon_key="mission_1", condition_type="missions_completed", condition_value=1),
    ]
    db.add_all(achievements)
    db.commit()
    return achievements


@pytest.fixture()
def sample_foods(db) -> list[FoodItem]:
    """Seed food items."""
    foods = [
        FoodItem(name="Chicken Breast", calories_per100g=165, protein_per100g=31, carbs_per100g=0, fat_per100g=3.6, is_custom=False),
        FoodItem(name="Brown Rice", calories_per100g=112, protein_per100g=2.6, carbs_per100g=23.5, fat_per100g=0.9, is_custom=False),
        FoodItem(name="Banana", calories_per100g=89, protein_per100g=1.1, carbs_per100g=22.8, fat_per100g=0.3, is_custom=False),
    ]
    db.add_all(foods)
    db.commit()
    return foods
