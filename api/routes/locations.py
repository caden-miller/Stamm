"""
Location / GeoJSON endpoints.

GET  /api/locations           — list all locations
GET  /api/locations/geojson   — GeoJSON FeatureCollection of geocoded events
GET  /api/locations/geocode/stream — SSE stream for geocoding pending locations
POST /api/locations/merge     — merge duplicate locations
"""
import json
import time
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db.models import Event, EventType, Person, Location
from api.deps import get_db
from api.schemas import (
    LocationOut, GeoFeature, GeoFeatureCollection, GeoProperties,
    LocationMergeRequest, LocationMergeResponse,
)

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=List[LocationOut])
def list_locations(
    geocode_status: Optional[str] = Query(None, description="Filter by geocode status"),
    search: Optional[str] = Query(None, description="Search location text"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all locations with event counts."""
    q = db.query(Location)

    if geocode_status:
        q = q.filter(Location.geocode_status == geocode_status)

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (Location.normalized.ilike(pattern))
            | (Location.raw_text.ilike(pattern))
            | (Location.city.ilike(pattern))
            | (Location.state.ilike(pattern))
            | (Location.country.ilike(pattern))
        )

    q = q.order_by(Location.normalized)
    locations = q.offset(offset).limit(limit).all()

    results = []
    for loc in locations:
        event_count = db.query(Event).filter(Event.location_id == loc.id).count()
        results.append(LocationOut(
            id=loc.id,
            raw_text=loc.raw_text,
            normalized=loc.normalized,
            city=loc.city,
            county=loc.county,
            state=loc.state,
            country=loc.country,
            latitude=loc.latitude,
            longitude=loc.longitude,
            geocode_status=loc.geocode_status,
            event_count=event_count,
        ))

    return results


@router.get("/geojson", response_model=GeoFeatureCollection)
def get_geojson(
    date_from: Optional[str] = Query(None, description="Start of date range (ISO)"),
    date_to: Optional[str] = Query(None, description="End of date range (ISO)"),
    event_types: Optional[str] = Query(
        None,
        description="Comma-separated event type codes",
    ),
    person_ids: Optional[str] = Query(None, description="Comma-separated person IDs"),
    db: Session = Depends(get_db),
):
    """
    Return a GeoJSON FeatureCollection of geocoded events.

    Only events whose location has been successfully geocoded are included.
    Each feature is a Point with event metadata as properties.
    """
    q = (
        db.query(Event, EventType, Person, Location)
        .join(EventType, Event.event_type_id == EventType.id)
        .join(Person, Event.person_id == Person.id)
        .join(Location, Event.location_id == Location.id)
        .filter(
            Location.latitude.isnot(None),
            Location.longitude.isnot(None),
        )
    )

    if date_from:
        q = q.filter(Event.date_sort >= date_from)
    if date_to:
        q = q.filter(Event.date_sort <= date_to)

    if event_types:
        codes = [c.strip().upper() for c in event_types.split(",") if c.strip()]
        if codes:
            q = q.filter(EventType.code.in_(codes))

    if person_ids:
        try:
            pids = [int(p.strip()) for p in person_ids.split(",") if p.strip()]
            if pids:
                q = q.filter(Event.person_id.in_(pids))
        except ValueError:
            pass

    q = q.order_by(Event.date_sort)
    rows = q.all()

    features = []
    for event, et, person, loc in rows:
        features.append(GeoFeature(
            geometry={
                "type": "Point",
                "coordinates": [loc.longitude, loc.latitude],  # GeoJSON is [lng, lat]
            },
            properties=GeoProperties(
                event_id=event.id,
                person_id=person.id,
                person_name=person.display_name,
                event_type=et.code,
                event_label=et.label,
                color=et.color,
                date_sort=event.date_sort,
                date_raw=event.date_raw,
                date_precision=event.date_precision,
                location_name=loc.normalized or loc.raw_text,
            ),
        ))

    return GeoFeatureCollection(features=features)


@router.get("/geocode/stream")
def geocode_stream(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    SSE endpoint that geocodes pending locations one by one.
    Streams progress events as JSON.
    """
    from ingestion.geocoder import _geocode_single, RATE_LIMIT_SECONDS

    locations = (
        db.query(Location)
        .filter(Location.geocode_status == "pending")
        .limit(limit)
        .all()
    )
    total = len(locations)

    def generate():
        stats = {"success": 0, "failed": 0, "skipped": 0, "total": total}

        for i, loc in enumerate(locations):
            search_text = loc.normalized or loc.raw_text
            if not search_text or search_text.lower() in ("unknown", ""):
                loc.geocode_status = "skipped"
                stats["skipped"] += 1
                event = {
                    "type": "progress",
                    "location_id": loc.id,
                    "raw_text": loc.raw_text,
                    "status": "skipped",
                    "latitude": None,
                    "longitude": None,
                    "current": i + 1,
                    "total": total,
                }
                db.commit()
                yield f"data: {json.dumps(event)}\n\n"
                continue

            coords = _geocode_single(search_text)
            if coords:
                loc.latitude, loc.longitude = coords
                loc.geocode_status = "success"
                stats["success"] += 1
                status = "success"
            else:
                loc.geocode_status = "failed"
                stats["failed"] += 1
                status = "failed"

            db.commit()

            event = {
                "type": "progress",
                "location_id": loc.id,
                "raw_text": loc.raw_text,
                "status": status,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "current": i + 1,
                "total": total,
            }
            yield f"data: {json.dumps(event)}\n\n"

            # Rate limit
            if i < total - 1:
                time.sleep(RATE_LIMIT_SECONDS)

        # Summary
        summary = {"type": "summary", **stats}
        yield f"data: {json.dumps(summary)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/merge", response_model=LocationMergeResponse)
def merge_locations(
    req: LocationMergeRequest,
    db: Session = Depends(get_db),
):
    """
    Merge source locations into a target location.
    All events referencing source locations get reassigned to the target.
    Source locations are then deleted.
    """
    target = db.query(Location).filter(Location.id == req.target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target location not found")

    source_ids = [sid for sid in req.source_ids if sid != req.target_id]
    if not source_ids:
        raise HTTPException(status_code=400, detail="No valid source locations to merge")

    sources = db.query(Location).filter(Location.id.in_(source_ids)).all()
    if len(sources) != len(source_ids):
        raise HTTPException(status_code=404, detail="One or more source locations not found")

    # Reassign events
    events_updated = (
        db.query(Event)
        .filter(Event.location_id.in_(source_ids))
        .update({Event.location_id: req.target_id}, synchronize_session="fetch")
    )

    # Delete source locations
    for src in sources:
        db.delete(src)

    db.commit()

    event_count = db.query(Event).filter(Event.location_id == target.id).count()

    return LocationMergeResponse(
        target=LocationOut(
            id=target.id,
            raw_text=target.raw_text,
            normalized=target.normalized,
            city=target.city,
            county=target.county,
            state=target.state,
            country=target.country,
            latitude=target.latitude,
            longitude=target.longitude,
            geocode_status=target.geocode_status,
            event_count=event_count,
        ),
        merged_count=len(sources),
        events_updated=events_updated,
    )
