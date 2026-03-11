from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    description="Adaptive gamified gym tracking app",
    version="0.1.0",
    # docs только в development
    docs_url="/docs" if settings.APP_ENV == "development" else None,
    redoc_url="/redoc" if settings.APP_ENV == "development" else None,
)

# CORS — разрешаем Expo (localhost + любой IP для девайса в сети)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",    # Expo web
        "http://localhost:19006",   # Expo metro
        "http://192.168.0.0/16",    # локальная сеть (для телефона)
        "*",                        # TODO: убрать в production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health check ──────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}


# ─── Routers (подключаем по мере разработки) ──────────────────────
from app.api import auth  # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Будем добавлять сюда:
# from app.api import workouts, exercises, missions, campaigns, progress, coach
# app.include_router(workouts.router, prefix="/api/workouts", tags=["Workouts"])
# и т.д.