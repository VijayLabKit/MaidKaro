"""
Centralized application configuration.
All values are loaded from environment variables / .env — nothing is
hardcoded so the same image runs in dev, staging, and production.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "MaidKaro API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite:///./maidkaro_dev.db"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Security
    JWT_SECRET_KEY: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ADMIN_JWT_SECRET_KEY: str = "dev-admin-secret-change-me"

    # OTP
    SMS_PROVIDER: str = "dev_logger"
    MSG91_API_KEY: str = ""
    MSG91_SENDER_ID: str = "MAIDKR"
    OTP_EXPIRY_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5

    # Email (registration confirmations, password reset)
    EMAIL_PROVIDER: str = "dev_logger"  # "dev_logger" | "smtp"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    EMAIL_FROM_ADDRESS: str = "no-reply@maidkaro.in"
    EMAIL_FROM_NAME: str = "MaidKaro"

    # Password reset
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    PASSWORD_RESET_MAX_ACTIVE_TOKENS: int = 3  # rate-limit guard: max unused tokens per user at once
    CUSTOMER_WEB_BASE_URL: str = "http://localhost:3000"
    WORKER_WEB_BASE_URL: str = "http://localhost:3000"
    ADMIN_WEB_BASE_URL: str = "http://localhost:3001"

    # File storage (KYC documents, profile photos) — local disk in dev,
    # swap for S3/GCS in production (see app/uploads/router.py).
    UPLOAD_DIR: str = "./uploads"
    UPLOAD_URL_PREFIX: str = "/media"

    # Payments
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Object storage
    S3_ENDPOINT_URL: str = ""
    S3_BUCKET: str = "maidkaro-uploads"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "ap-south-1"
    S3_SIGNED_URL_EXPIRY_SECONDS: int = 600

    # Safety
    SAFETY_ESCALATION_PHONE: str = ""
    EXOTEL_SID: str = ""
    EXOTEL_TOKEN: str = ""
    EXOTEL_VIRTUAL_NUMBER: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://localhost:8081"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
