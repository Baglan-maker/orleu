from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    description="Adaptive gamified gym tracking app",
    version="0.1.0",
    docs_url="/docs"  if settings.APP_ENV == "development" else None,
    redoc_url="/redoc" if settings.APP_ENV == "development" else None,
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

app.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(exercises.router, prefix="/api/exercises",  tags=["Exercises"])
app.include_router(workouts.router,  prefix="/api/workouts",   tags=["Workouts"])

# Phase 4-5:
# from app.api import missions, campaigns, progress, predictions, coach