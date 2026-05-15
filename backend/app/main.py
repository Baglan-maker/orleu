from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.tasks.mission_expiry import expire_overdue_missions
from app.tasks.mission_reset import weekly_mission_reset
from app.tasks.nightly_ml import run_nightly_predictions

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Expire overdue missions on startup, then every hour
    expire_overdue_missions()
    scheduler.add_job(expire_overdue_missions, "interval", hours=1, id="expire_missions")
    # Weekly Monday reset at 00:00 UTC — abandon all remaining active missions
    scheduler.add_job(weekly_mission_reset, "cron", day_of_week="mon", hour=0, minute=0, id="weekly_mission_reset")
    scheduler.add_job(run_nightly_predictions, "cron", hour=0, minute=0, id="nightly_ml")
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(
    title=settings.APP_NAME,
    description="Adaptive gamified gym tracking app",
    version="0.1.0",
    docs_url="/docs"  if settings.APP_ENV == "development" else None,
    redoc_url="/redoc" if settings.APP_ENV == "development" else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:19006",
        "http://192.168.0.0/16",
        "*",                        # TODO: убрать в production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}


from app.api import auth       # noqa: E402
from app.api import exercises  # noqa: E402
from app.api import workouts   # noqa: E402
from app.api import progress   # noqa: E402
from app.api import campaigns  # noqa: E402
from app.api import missions      # noqa: E402
from app.api import achievements  # noqa: E402
from app.api import debug         # noqa: E402
from app.api import nutrition         # noqa: E402
from app.api import personal_records  # noqa: E402
from app.api import coach             # noqa: E402
from app.api import admin             # noqa: E402

app.include_router(auth.router,             prefix="/api/auth",         tags=["Auth"])
app.include_router(exercises.router,        prefix="/api/exercises",    tags=["Exercises"])
app.include_router(workouts.router,         prefix="/api/workouts",     tags=["Workouts"])
app.include_router(progress.router,         prefix="/api/progress",     tags=["Gamification"])
app.include_router(campaigns.router,        prefix="/api/campaigns",    tags=["Gamification"])
app.include_router(missions.router,         prefix="/api/missions",     tags=["Gamification"])
app.include_router(achievements.router,     prefix="/api/achievements", tags=["Gamification"])
app.include_router(debug.router,            prefix="/api/debug",        tags=["Debug"])
app.include_router(nutrition.router,        prefix="/api/nutrition",    tags=["Nutrition"])
app.include_router(personal_records.router, prefix="/api/prs",          tags=["Personal Records"])
app.include_router(coach.router,            prefix="/api/coach",        tags=["Coach"])
app.include_router(admin.router,            prefix="/admin",            tags=["Admin"])