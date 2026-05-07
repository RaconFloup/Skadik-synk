from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://skadik:skadik@localhost:5432/skadik"
    SECRET_KEY: str = "change-me-in-production"

    TERMIX_URL: str = "http://example.com"
    TERMIX_USERNAME: str = ""
    TERMIX_PASSWORD: str = ""

    GOOGLE_SCRIPT_URL: str = ""
    GOOGLE_FOLDER_ID: str = ""

    TELEGRAM_BOT_TOKEN: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
