"""
GEDCOM file upload endpoint.
"""
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from api.deps import get_db
from db.models import get_engine, get_session, init_db
from ingestion.parser import parse_gedcom
from ingestion.loader import load_gedcom
from ingestion.validator import validate_all


router = APIRouter(prefix="/api/upload", tags=["upload"])


def run_ingestion_pipeline(filepath: str):
    """
    Run the GEDCOM ingestion pipeline on an uploaded file.
    This runs in the background after the file is uploaded.
    """
    try:
        engine = get_engine()
        init_db(engine)
        session = get_session(engine)

        # Parse GEDCOM
        persons, families = parse_gedcom(filepath)

        # Load into database
        stats = load_gedcom(session, persons, families)

        # Validate
        conflict_count = validate_all(session)

        session.close()

        # Clean up temp file
        if os.path.exists(filepath):
            os.remove(filepath)

        return {
            "success": True,
            "persons_loaded": len(persons),
            "families_loaded": len(families),
            "conflicts_found": conflict_count,
        }
    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(filepath):
            os.remove(filepath)
        raise e


@router.post("/gedcom")
async def upload_gedcom(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a GEDCOM file for ingestion.

    The file is validated, saved to a temporary location, and then
    processed in the background. Returns immediately with upload status.
    """
    # Validate file extension
    if not file.filename or not file.filename.lower().endswith(('.ged', '.gedcom')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .ged or .gedcom files are accepted."
        )

    # Save uploaded file to temp directory
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"upload_{os.getpid()}_{file.filename}")

    try:
        # Read and save file
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        if len(content) > 100 * 1024 * 1024:  # 100MB limit
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 100MB.")

        with open(temp_path, "wb") as f:
            f.write(content)

        # Run ingestion in background
        # For now, run synchronously (FastAPI background tasks are lightweight)
        # For production, consider using Celery or similar for true async processing
        result = run_ingestion_pipeline(temp_path)

        return {
            "status": "success",
            "message": "GEDCOM file ingested successfully",
            "filename": file.filename,
            "persons_loaded": result["persons_loaded"],
            "families_loaded": result["families_loaded"],
            "conflicts_found": result["conflicts_found"],
        }

    except HTTPException:
        # Re-raise HTTP exceptions
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
    except Exception as e:
        # Clean up and return error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing GEDCOM file: {str(e)}"
        )
