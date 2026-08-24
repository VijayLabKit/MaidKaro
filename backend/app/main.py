"""
MaidKaro API — FastAPI application factory.
Run locally: uvicorn app.main:app --reload
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.database import Base, engine

# Routers
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.workers.router import router as workers_router
from app.services.router import router as catalog_router
from app.bookings.router import router as bookings_router
from app.payments.router import router as payments_router
from app.reviews.router import router as reviews_router
from app.chat.router import router as chat_router
from app.support.router import router as support_router
from app.admin.router import router as admin_router
from app.locations.router import router as locations_router
from app.analytics.router import router as analytics_router
from app.ai.router import router as ai_router
from app.uploads.router import router as uploads_router
from app.notifications.router import router as notifications_router

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)
logger = logging.getLogger("maidkaro")

app = FastAPI(
    title=settings.APP_NAME,
    description="MaidKaro — verified home-service marketplace API. Women-first trust & safety features "
                "(in-app chat, SOS escalation, call masking) are first-class, not bolt-ons.",
    version="2.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Pydantic v2 puts the raw exception object in error["ctx"]["error"]
    # (e.g. a ValueError from a @field_validator) which json.dumps can't
    # serialize on its own — stringify ctx before it hits the response.
    safe_errors = []
    for err in exc.errors():
        err = dict(err)
        if isinstance(err.get("ctx"), dict) and "error" in err["ctx"]:
            err["ctx"] = {**err["ctx"], "error": str(err["ctx"]["error"])}
        safe_errors.append(err)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": safe_errors, "message": "Validation failed"},
    )


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": settings.APP_NAME, "environment": settings.ENVIRONMENT}


API_PREFIX = settings.API_V1_PREFIX
for router in (
    auth_router, users_router, workers_router, catalog_router, bookings_router,
    payments_router, reviews_router, chat_router, support_router, admin_router,
    locations_router, analytics_router, ai_router, uploads_router,
    notifications_router,
):
    app.include_router(router, prefix=API_PREFIX)

# Serve uploaded KYC documents / profile photos locally in dev. In
# production this mount is unused — UPLOAD_URL_PREFIX should point at a
# CDN/S3 bucket URL instead (see app/uploads/router.py).
import os
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount(settings.UPLOAD_URL_PREFIX, StaticFiles(directory=settings.UPLOAD_DIR), name="media")


@app.on_event("startup")
def on_startup():
    # In production, schema changes are managed exclusively through
    # Alembic migrations (see migrations/). create_all() here is a
    # convenience fallback for a from-scratch SQLite dev environment
    # only, and is a no-op against any table that already exists.
    if settings.ENVIRONMENT == "development":
        Base.metadata.create_all(bind=engine)
        logger.info("Development mode: ensured all tables exist via metadata.create_all().")
