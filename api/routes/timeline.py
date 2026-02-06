"""
Timeline endpoint — returns data formatted for vis-timeline.

GET /api/timeline — returns {items: [...], groups: [...]}
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db.models import Event, EventType, Person
from api.deps import get_db
from api.schemas import TimelineItem, TimelineGroup, TimelineResponse

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("", response_model=TimelineResponse)
def get_timeline(
    date_from: Optional[str] = Query(None, description="Start of date range (ISO)"),
    date_to: Optional[str] = Query(None, description="End of date range (ISO)"),
    event_types: Optional[str] = Query(
        None,
        description="Comma-separated event type codes to include (e.g. BIRT,DEAT,MARR)",
    ),
    person_ids: Optional[str] = Query(
        None,
        description="Comma-separated person IDs to include",
    ),
    db: Session = Depends(get_db),
):
    """
    Return timeline data formatted for vis-timeline.

    Only events with a date_sort value are included (undated events
    can't be placed on a timeline).
    """
    # Build event query
    q = db.query(Event).filter(Event.date_sort.isnot(None))

    if date_from:
        q = q.filter(Event.date_sort >= date_from)
    if date_to:
        q = q.filter(Event.date_sort <= date_to)

    # Filter by event type codes
    type_filter_ids = None
    if event_types:
        codes = [c.strip().upper() for c in event_types.split(",") if c.strip()]
        if codes:
            matching = db.query(EventType).filter(EventType.code.in_(codes)).all()
            type_filter_ids = {et.id for et in matching}
            q = q.filter(Event.event_type_id.in_(type_filter_ids))

    # Filter by person IDs
    if person_ids:
        try:
            pids = [int(p.strip()) for p in person_ids.split(",") if p.strip()]
            if pids:
                q = q.filter(Event.person_id.in_(pids))
        except ValueError:
            pass  # ignore malformed input

    q = q.order_by(Event.date_sort)
    events = q.all()

    # Pre-load lookups
    et_cache = {}
    person_cache = {}

    # Collect unique persons for groups
    person_ids_seen = set()

    items = []
    for e in events:
        # Event type
        if e.event_type_id not in et_cache:
            et_cache[e.event_type_id] = db.query(EventType).filter(
                EventType.id == e.event_type_id
            ).first()
        et = et_cache[e.event_type_id]

        # Person
        if e.person_id not in person_cache:
            person_cache[e.person_id] = db.query(Person).filter(
                Person.id == e.person_id
            ).first()
        person = person_cache[e.person_id]

        if not et or not person:
            continue

        person_ids_seen.add(e.person_id)

        # vis-timeline item
        label = "{} - {}".format(et.label, person.display_name)
        date_display = e.date_raw or e.date_sort
        tooltip = "{}: {} ({})".format(
            person.display_name, et.label, date_display,
        )

        items.append(TimelineItem(
            id=e.id,
            content=label,
            start=e.date_sort,
            end=e.date_end,
            group=e.person_id,
            className="event-{}".format(et.code.lower()),
            style="background-color: {}; border-color: {};".format(et.color, et.color),
            title=tooltip,
            event_type=et.code,
        ))

    # Build groups (one per person)
    groups = []
    for pid in sorted(person_ids_seen):
        p = person_cache.get(pid)
        if p:
            groups.append(TimelineGroup(
                id=p.id,
                content=p.display_name,
                order=p.id,
            ))

    return TimelineResponse(items=items, groups=groups)
