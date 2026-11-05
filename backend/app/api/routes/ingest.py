from datetime import datetime, timezone, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.ingest import IngestionRequest, IngestionResponse, IngestionRunSummary
from app.services.ingestion import IngestionService
from app.core.logging import logger

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


@router.post(
    "",
    response_model=IngestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger Elexon data ingestion",
    description="Fetch, validate, normalize, and persist FUELHH actuals and/or WINDFOR forecasts from Elexon BMRS.",
)
async def trigger_ingestion(
    request: IngestionRequest,
    db: Session = Depends(get_db),
) -> IngestionResponse:
    dataset = request.dataset.upper()
    valid_datasets = ["FUELHH", "WINDFOR", "ALL"]
    if dataset not in valid_datasets:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid dataset '{request.dataset}'. Must be one of {valid_datasets}.",
        )

    service = IngestionService()
    runs = []

    try:
        if dataset == "FUELHH":
            run = await service.ingest_fuelhh(
                db=db,
                date_from=request.start_date,
                date_to=request.end_date,
            )
            runs.append(run)
        elif dataset == "WINDFOR":
            p_from = None
            p_to = None
            if request.start_date:
                p_from = datetime.combine(request.start_date, datetime.min.time(), tzinfo=timezone.utc)
            if request.end_date:
                p_to = datetime.combine(request.end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

            run = await service.ingest_windfor(
                db=db,
                publish_from=p_from,
                publish_to=p_to,
                date_from=request.start_date,
                date_to=request.end_date,
            )
            runs.append(run)
        elif dataset == "ALL":
            all_runs = await service.ingest_all(
                db=db,
                date_from=request.start_date,
                date_to=request.end_date,
                force_reload=request.force_reload,
            )
            runs.extend(all_runs)

        run_summaries = [
            IngestionRunSummary(
                id=r.id,
                dataset=r.dataset,
                status=r.status,
                started_at=r.started_at,
                completed_at=r.completed_at,
                records_received=r.records_received,
                records_inserted=r.records_inserted,
                records_updated=r.records_updated,
                records_rejected=r.records_rejected,
                error_message=r.error_message,
                parameters=r.parameters,
            )
            for r in runs
        ]

        failed_runs = [r for r in runs if r.status == "failed"]
        overall_status = "partial" if failed_runs and len(runs) > 1 else ("failed" if failed_runs else "success")

        return IngestionResponse(
            status=overall_status,
            message=f"Ingestion completed for dataset={dataset}. Runs processed: {len(runs)}.",
            runs=run_summaries,
        )

    except Exception as exc:
        logger.error(f"Ingestion trigger encountered an unexpected error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {exc}",
        )
