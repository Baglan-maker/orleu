from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    APP_ENV: str = "development"
    APP_NAME: str = "Orleu"

    # OpenRouter LLM (optional — coach falls back to templates if missing)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_PRIMARY_MODEL:  str = "google/gemma-4-26b-a4b-it:free"
    OPENROUTER_FALLBACK_MODEL: str = "openai/gpt-oss-20b:free"
    OPENROUTER_TIMEOUT_S: float = 10.0

    # Admin dashboard (HTTP Basic auth on /admin/*). Disabled if either is empty.
    ADMIN_USERNAME: str = ""
    ADMIN_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()