from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://skadik:skadik@localhost:5432/skadik"
    SECRET_KEY: str = "change-me-in-production"
    AUTH_PASSWORD: str = "admin"
    JWT_SECRET: str = "change-me-in-production"
    CORS_ORIGINS: str = "http://localhost:3001,http://localhost:5173"
    TIMEZONE: str = "Europe/Moscow"
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
