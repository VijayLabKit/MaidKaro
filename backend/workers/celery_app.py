"""Celery application instance, configured off the same Settings used
by the API process so both share one source of truth for broker/result
backend URLs."""
from celery import Celery

from app.config import settings

celery_app = Celery(
    "maidkaro",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["workers.celery_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    beat_schedule={
        "expire-stale-pending-bookings": {
            "task": "workers.celery_tasks.expire_stale_pending_bookings",
            "schedule": 300.0,  # every 5 minutes
        },
        "process-worker-payouts": {
            "task": "workers.celery_tasks.process_pending_payouts",
            "schedule": 3600.0 * 24,  # daily
        },
        "cleanup-expired-otps": {
            "task": "workers.celery_tasks.cleanup_expired_otps",
            "schedule": 3600.0,  # hourly
        },
    },
)
