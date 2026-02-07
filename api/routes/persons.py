"""
Person endpoints.

GET /api/persons          — list with search/filter
GET /api/persons/{id}     — detail with events and families
PATCH /api/persons/{id}   — update person profile
GET /api/persons/{id}/events — events for a person
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.models import Person, Event, EventType, Location, Family, FamilyChild, Conflict
from api.deps import get_db
from api.schemas import (
    PersonSummary, PersonDetail, EventBrief, EventTypeOut,
    LocationBrief, FamilyBrief, PersonProfileUpdate, PersonReviewRequest,
)

router = APIRouter(prefix="/api/persons", tags=["persons"])


@router.get("", response_model=List[PersonSummary])
def list_persons(
    search: Optional[str] = Query(None, description="Search by name"),
    needs_review: Optional[bool] = Query(None, description="Filter by review status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all persons with optional search and filters."""
    q = db.query(Person)

    if search:
        pattern = "%{}%".format(search)
        q = q.filter(
            (Person.first_name.ilike(pattern)) |
            (Person.last_name.ilike(pattern)) |
            (Person.maiden_name.ilike(pattern))
        )

    if needs_review is not None:
        q = q.filter(Person.needs_review == (1 if needs_review else 0))

    q = q.order_by(Person.last_name, Person.first_name)
    persons = q.offset(offset).limit(limit).all()

    results = []
    for p in persons:
        event_count = db.query(Event).filter(Event.person_id == p.id).count()
        conflict_count = db.query(Conflict).filter(
            Conflict.person_id == p.id,
            Conflict.resolution.is_(None),
        ).count()
        results.append(PersonSummary(
            id=p.id,
            gedcom_id=p.gedcom_id,
            first_name=p.first_name,
            last_name=p.last_name,
            display_name=p.display_name,
            sex=p.sex,
            needs_review=bool(p.needs_review),
            event_count=event_count,
            conflict_count=conflict_count,
        ))

    return results


@router.get("/{person_id}", response_model=PersonDetail)
def get_person(person_id: int, db: Session = Depends(get_db)):
    """Get a single person with their events and family connections."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Build events list
    events = (
        db.query(Event)
        .filter(Event.person_id == person.id)
        .order_by(Event.date_sort)
        .all()
    )
    event_briefs = [_event_to_brief(e, db) for e in events]

    # Build families list
    family_briefs = _get_family_briefs(person, db)

    event_count = len(events)
    conflict_count = db.query(Conflict).filter(
        Conflict.person_id == person.id,
        Conflict.resolution.is_(None),
    ).count()

    return PersonDetail(
        id=person.id,
        gedcom_id=person.gedcom_id,
        first_name=person.first_name,
        last_name=person.last_name,
        maiden_name=person.maiden_name,
        display_name=person.display_name,
        sex=person.sex,
        needs_review=bool(person.needs_review),
        notes=person.notes,
        profile_image=person.profile_image,
        biography=person.biography,
        event_count=event_count,
        conflict_count=conflict_count,
        events=event_briefs,
        families=family_briefs,
    )


@router.patch("/{person_id}", response_model=PersonDetail)
def update_person_profile(
    person_id: int,
    update_data: PersonProfileUpdate,
    db: Session = Depends(get_db)
):
    """Update a person's profile information (image, biography, notes)."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Update only provided fields
    if update_data.profile_image is not None:
        person.profile_image = update_data.profile_image
    if update_data.biography is not None:
        person.biography = update_data.biography
    if update_data.notes is not None:
        person.notes = update_data.notes

    person.updated_at = datetime.utcnow().isoformat()

    db.commit()
    db.refresh(person)

    # Return updated person detail
    return get_person(person_id, db)


@router.get("/{person_id}/events", response_model=List[EventBrief])
def get_person_events(person_id: int, db: Session = Depends(get_db)):
    """Get all events for a person."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    events = (
        db.query(Event)
        .filter(Event.person_id == person.id)
        .order_by(Event.date_sort)
        .all()
    )
    return [_event_to_brief(e, db) for e in events]


@router.patch("/{person_id}/review", response_model=PersonSummary)
def review_person(
    person_id: int,
    body: PersonReviewRequest,
    db: Session = Depends(get_db),
):
    """Mark a person as reviewed (clears needs_review) or flag for review."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    person.needs_review = 0 if body.reviewed else 1
    person.updated_at = datetime.utcnow().isoformat()
    db.commit()

    event_count = db.query(Event).filter(Event.person_id == person.id).count()
    conflict_count = db.query(Conflict).filter(
        Conflict.person_id == person.id,
        Conflict.resolution.is_(None),
    ).count()

    return PersonSummary(
        id=person.id,
        gedcom_id=person.gedcom_id,
        first_name=person.first_name,
        last_name=person.last_name,
        display_name=person.display_name,
        sex=person.sex,
        needs_review=bool(person.needs_review),
        event_count=event_count,
        conflict_count=conflict_count,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _event_to_brief(event, db):
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

    return EventBrief(
        id=event.id,
        event_type=EventTypeOut(
            id=et.id, code=et.code, label=et.label, color=et.color,
        ) if et else EventTypeOut(id=0, code="?", label="Unknown", color="#999"),
        date_raw=event.date_raw,
        date_sort=event.date_sort,
        date_precision=event.date_precision,
        location=loc,
        validation_status=event.validation_status,
    )


def _get_family_briefs(person, db):
    """Build family connections for a person."""
    briefs = []

    # Families as spouse
    spouse_families = (
        db.query(Family)
        .filter((Family.husband_id == person.id) | (Family.wife_id == person.id))
        .all()
    )
    for fam in spouse_families:
        # Determine the other spouse
        if fam.husband_id == person.id:
            other = db.query(Person).filter(Person.id == fam.wife_id).first() if fam.wife_id else None
        else:
            other = db.query(Person).filter(Person.id == fam.husband_id).first() if fam.husband_id else None

        children_names = []
        for fc in fam.children:
            child = db.query(Person).filter(Person.id == fc.child_id).first()
            if child:
                children_names.append(child.display_name)

        briefs.append(FamilyBrief(
            id=fam.id,
            gedcom_id=fam.gedcom_id,
            role="spouse",
            spouse_name=other.display_name if other else None,
            children=children_names,
        ))

    # Families as child
    child_links = db.query(FamilyChild).filter(FamilyChild.child_id == person.id).all()
    for fc in child_links:
        fam = db.query(Family).filter(Family.id == fc.family_id).first()
        if not fam:
            continue
        father = db.query(Person).filter(Person.id == fam.husband_id).first() if fam.husband_id else None
        mother = db.query(Person).filter(Person.id == fam.wife_id).first() if fam.wife_id else None
        parent_name = " & ".join(
            p.display_name for p in [father, mother] if p
        ) or None

        siblings = []
        for sib_fc in fam.children:
            if sib_fc.child_id != person.id:
                sib = db.query(Person).filter(Person.id == sib_fc.child_id).first()
                if sib:
                    siblings.append(sib.display_name)

        briefs.append(FamilyBrief(
            id=fam.id,
            gedcom_id=fam.gedcom_id,
            role="child",
            spouse_name=parent_name,  # reuse field as "parents"
            children=siblings,        # reuse as "siblings"
        ))

    return briefs
