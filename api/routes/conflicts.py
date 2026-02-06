"""
Conflict endpoints.

GET   /api/conflicts       — list conflicts (default: unresolved only)
GET   /api/conflicts/{id}  — single conflict detail
PATCH /api/conflicts/{id}  — update resolution
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.models import Conflict, Person, Event
from api.deps import get_db
from api.schemas import ConflictOut, ConflictResolveRequest

router = APIRouter(prefix="/api/conflicts", tags=["conflicts"])

_VALID_RESOLUTIONS = {"confirmed", "rejected", "needs_review", "auto_fixed"}


@router.get("", response_model=List[ConflictOut])
def list_conflicts(
    person_id: Optional[int] = Query(None, description="Filter by person"),
    severity: Optional[str] = Query(None, description="Filter by severity (error, warning, info)"),
    unresolved_only: bool = Query(True, description="Only show unresolved conflicts"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List conflicts, defaulting to unresolved only."""
    q = db.query(Conflict)

    if unresolved_only:
        q = q.filter(Conflict.resolution.is_(None))

    if person_id is not None:
        q = q.filter(Conflict.person_id == person_id)

    if severity:
        q = q.filter(Conflict.severity == severity.lower())

    q = q.order_by(Conflict.severity.desc(), Conflict.id)
    conflicts = q.offset(offset).limit(limit).all()

    return [_conflict_to_out(c, db) for c in conflicts]


@router.get("/{conflict_id}", response_model=ConflictOut)
def get_conflict(conflict_id: int, db: Session = Depends(get_db)):
    """Get a single conflict by ID."""
    conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return _conflict_to_out(conflict, db)


@router.patch("/{conflict_id}", response_model=ConflictOut)
def resolve_conflict(
    conflict_id: int,
    body: ConflictResolveRequest,
    db: Session = Depends(get_db),
):
    """Resolve a conflict (confirm, reject, or mark as needs_review)."""
    conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")

    if body.resolution not in _VALID_RESOLUTIONS:
        raise HTTPException(
            status_code=400,
            detail="resolution must be one of: {}".format(", ".join(sorted(_VALID_RESOLUTIONS))),
        )

    conflict.resolution = body.resolution
    conflict.resolved_at = datetime.utcnow().isoformat()
    conflict.resolved_by = "web"
    if body.notes:
        conflict.notes = body.notes

    # Update the associated event's validation_status
    if conflict.event_id:
        event = db.query(Event).filter(Event.id == conflict.event_id).first()
        if event:
            if body.resolution == "confirmed":
                event.validation_status = "valid"
            elif body.resolution == "rejected":
                event.validation_status = "needs_review"

    # Update person's needs_review flag
    person = db.query(Person).filter(Person.id == conflict.person_id).first()
    if person:
        still_unresolved = db.query(Conflict).filter(
            Conflict.person_id == person.id,
            Conflict.resolution.is_(None),
        ).count()
        person.needs_review = 1 if still_unresolved > 0 else 0

    db.commit()

    return _conflict_to_out(conflict, db)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _conflict_to_out(conflict, db):
    person = db.query(Person).filter(Person.id == conflict.person_id).first()
    return ConflictOut(
        id=conflict.id,
        person_id=conflict.person_id,
        person_name=person.display_name if person else "(Unknown)",
        event_id=conflict.event_id,
        related_event_id=conflict.related_event_id,
        conflict_type=conflict.conflict_type,
        description=conflict.description,
        severity=conflict.severity,
        resolution=conflict.resolution,
        resolved_at=conflict.resolved_at,
        resolved_by=conflict.resolved_by,
        notes=conflict.notes,
    )
