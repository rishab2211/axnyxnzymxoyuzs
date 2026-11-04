from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect

from app.api.routes import api_router
from app.api.routes.health import router as health_router
from app.core.config import settings
from app.core.logging import logger
from app.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Initializing WindScope backend service...")
    logger.info(f"Environment: {settings.ENVIRONMENT} | Version: {settings.VERSION}")
    logger.info(f"Default Decision Cutoff: {settings.DEFAULT_DECISION_CUTOFF} UTC")

    # Verify Database Connection & Tables
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            logger.info("Database connection established successfully.")

            # Ensure tables exist
            Base.metadata.create_all(bind=engine)
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            logger.info(f"Database tables verified: {tables}")

            # Check if database is empty for auto-ingestion
            actual_count = conn.execute(text("SELECT COUNT(*) FROM actual_generation")).scalar() or 0
            forecast_count = conn.execute(text("SELECT COUNT(*) FROM wind_forecasts")).scalar() or 0

            logger.info(f"Current records in DB: actual_generation={actual_count}, wind_forecasts={forecast_count}")

            if settings.AUTO_INGEST_ON_STARTUP and (actual_count == 0 or forecast_count == 0):
                logger.info("AUTO_INGEST_ON_STARTUP=True and database is empty. Auto-ingest flag is primed.")
    except Exception as exc:
        logger.warning(
            f"Database not available on startup: {exc}. "
            "Backend will remain running and report degraded health until DB is connected."
        )

    yield

    logger.info("Shutting down WindScope backend service...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Production-quality energy analytics platform for UK electricity utilities to evaluate "
        "national wind generation forecasts (Elexon WINDFOR) against actual outturn (Elexon FUELHH)."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Explicit CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Root-level health endpoint (for cloud provider health probes)
app.include_router(health_router)

# Versioned API routes (/api/...)
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
