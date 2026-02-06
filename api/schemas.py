"""
Pydantic models for API request/response validation.
"""
from typing import Optional, List
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class EventTypeOut(BaseModel):
    id: int
    code: str
    label: str
    color: str

    class Config:
        from_attributes = True


class LocationBrief(BaseModel):
    id: int
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geocode_status: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Person
# ---------------------------------------------------------------------------

class PersonSummary(BaseModel):
    id: int
    gedcom_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: str
    sex: Optional[str] = None
    needs_review: bool
    event_count: int = 0
    conflict_count: int = 0

    class Config:
        from_attributes = True


class EventBrief(BaseModel):
    """Compact event representation used inside PersonDetail."""
    id: int
    event_type: EventTypeOut
    date_raw: Optional[str] = None
    date_sort: Optional[str] = None
    date_precision: str
    location: Optional[LocationBrief] = None
    validation_status: str

    class Config:
        from_attributes = True


class FamilyBrief(BaseModel):
    id: int
    gedcom_id: str
    role: str  # "spouse" or "child"
    spouse_name: Optional[str] = None
    children: List[str] = []

    class Config:
        from_attributes = True


class PersonDetail(PersonSummary):
    maiden_name: Optional[str] = None
    notes: Optional[str] = None
    events: List[EventBrief] = []
    families: List[FamilyBrief] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Event
# ---------------------------------------------------------------------------

class EventOut(BaseModel):
    id: int
    person_id: int
    person_name: str
    family_id: Optional[int] = None
    event_type: EventTypeOut
    date_raw: Optional[str] = None
    date_sort: Optional[str] = None
    date_end: Optional[str] = None
    date_precision: str
    location: Optional[LocationBrief] = None
    validation_status: str
    confidence: Optional[float] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Timeline (vis-timeline format)
# ---------------------------------------------------------------------------

class TimelineItem(BaseModel):
    id: int
    content: str        # HTML label
    start: str          # ISO date
    end: Optional[str] = None
    group: int          # person_id (maps to a TimelineGroup)
    className: str      # CSS class for styling
    style: str          # inline style (background-color)
    title: str          # hover tooltip
    event_type: str     # code for filtering

    class Config:
        from_attributes = True


class TimelineGroup(BaseModel):
    id: int             # person_id
    content: str        # person display name
    order: Optional[int] = None

    class Config:
        from_attributes = True


class TimelineResponse(BaseModel):
    items: List[TimelineItem]
    groups: List[TimelineGroup]


# ---------------------------------------------------------------------------
# GeoJSON
# ---------------------------------------------------------------------------

class GeoProperties(BaseModel):
    event_id: int
    person_id: int
    person_name: str
    event_type: str     # code
    event_label: str
    color: str
    date_sort: Optional[str] = None
    date_raw: Optional[str] = None
    date_precision: str
    location_name: str


class GeoFeature(BaseModel):
    type: str = "Feature"
    geometry: dict      # {"type": "Point", "coordinates": [lng, lat]}
    properties: GeoProperties


class GeoFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoFeature]


# ---------------------------------------------------------------------------
# Location
# ---------------------------------------------------------------------------

class LocationOut(BaseModel):
    id: int
    raw_text: str
    normalized: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geocode_status: str
    event_count: int = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Conflict
# ---------------------------------------------------------------------------

class ConflictOut(BaseModel):
    id: int
    person_id: int
    person_name: str
    event_id: Optional[int] = None
    related_event_id: Optional[int] = None
    conflict_type: str
    description: str
    severity: str
    resolution: Optional[str] = None
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class ConflictResolveRequest(BaseModel):
    resolution: str     # confirmed | rejected | needs_review
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class StatsOut(BaseModel):
    persons: int
    families: int
    events: int
    locations: int
    locations_geocoded: int
    locations_pending: int
    conflicts_total: int
    conflicts_unresolved: int
    persons_needing_review: int
