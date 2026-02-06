"""
Location / GeoJSON endpoints.

GET /api/locations       — list all locations
GET /api/locations/geojson — GeoJSON FeatureCollection of geocoded events
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import Event, EventType, Person, Location
from api.deps import get_db
from api.schemas import (
    LocationOut, GeoFeature, GeoFeatureCollection, GeoProperties,
)

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=List[LocationOut])
def list_locations(
    geocode_status: Optional[str] = Query(None, description="Filter by geocode status"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all locations with event counts."""
    q = db.query(Location)

    if geocode_status:
        q = q.filter(Location.geocode_status == geocode_status)

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
