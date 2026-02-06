"""
Event endpoints.

GET /api/events       — list with filters (date range, type, person)
GET /api/events/{id}  — single event detail
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.models import Event, EventType, Person, Location
from api.deps import get_db
from api.schemas import EventOut, EventTypeOut, LocationBrief

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[EventOut])
def list_events(
    person_id: Optional[int] = Query(None, description="Filter by person"),
    event_type: Optional[str] = Query(None, description="Filter by event type code (BIRT, DEAT, etc.)"),
    date_from: Optional[str] = Query(None, description="Start of date range (ISO: YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End of date range (ISO: YYYY-MM-DD)"),
    validation_status: Optional[str] = Query(None, description="Filter by validation status"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List events with optional filters."""
    q = db.query(Event)

    if person_id is not None:
        q = q.filter(Event.person_id == person_id)

    if event_type:
        et = db.query(EventType).filter(EventType.code == event_type.upper()).first()
        if et:
            q = q.filter(Event.event_type_id == et.id)

    if date_from:
        q = q.filter(Event.date_sort >= date_from)

    if date_to:
        q = q.filter(Event.date_sort <= date_to)

    if validation_status:
        q = q.filter(Event.validation_status == validation_status)

    # SQLite doesn't support NULLS LAST — use a CASE expression instead
    from sqlalchemy import case
    q = q.order_by(
        case((Event.date_sort.is_(None), 1), else_=0),
        Event.date_sort.asc(),
    )
    events = q.offset(offset).limit(limit).all()

    return [_event_to_out(e, db) for e in events]


@router.get("/types", response_model=List[EventTypeOut])
def list_event_types(db: Session = Depends(get_db)):
    """List all available event types."""
    types = db.query(EventType).order_by(EventType.sort_order).all()
    return [
        EventTypeOut(id=et.id, code=et.code, label=et.label, color=et.color)
        for et in types
    ]


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Get a single event by ID."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_to_out(event, db)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _event_to_out(event, db):
    person = db.query(Person).filter(Person.id == event.person_id).first()
    et = db.query(EventType).filter(EventType.id == event.event_type_id).first()

    loc = None
    if event.location_id:
        db_loc = db.query(Location).filter(Location.id == event.location_id).first()
        if db_loc:
            loc = LocationBrief(
                id=db_loc.id,
                name=db_loc.normalized or db_loc.raw_text,
                latitude=db_loc.latitude,
                longitude=db_loc.longitude,
                geocode_status=db_loc.geocode_status,
            )

    return EventOut(
        id=event.id,
        person_id=event.person_id,
        person_name=person.display_name if person else "(Unknown)",
        family_id=event.family_id,
        event_type=EventTypeOut(
            id=et.id, code=et.code, label=et.label, color=et.color,
        ) if et else EventTypeOut(id=0, code="?", label="Unknown", color="#999"),
        date_raw=event.date_raw,
        date_sort=event.date_sort,
        date_end=event.date_end,
        date_precision=event.date_precision,
        location=loc,
        validation_status=event.validation_status,
        confidence=event.confidence,
        description=event.description,
    )
