"""
Analytics and insights endpoints for ancestry data.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_db
from db.models import Person, Event, EventType, Location, Family


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/origins")
def get_ancestral_origins(db: Session = Depends(get_db)):
    """
    Get distribution of ancestral origins by country and state.
    Returns birth and death locations grouped by geographic region.
    """
    # Get birth event type ID
    birth_type = db.query(EventType).filter(EventType.code == "BIRT").first()
    death_type = db.query(EventType).filter(EventType.code == "DEAT").first()

    results = {
        "birth_countries": [],
        "birth_states": [],
        "death_countries": [],
        "death_states": [],
    }

    if birth_type:
        # Birth locations by country
        birth_countries = (
            db.query(
                Location.country,
                func.count(Event.id).label("count")
            )
            .join(Event, Event.location_id == Location.id)
            .filter(
                Event.event_type_id == birth_type.id,
                Location.country.isnot(None),
                Location.country != ""
            )
            .group_by(Location.country)
            .order_by(func.count(Event.id).desc())
            .limit(20)
            .all()
        )
        results["birth_countries"] = [
            {"country": row[0], "count": row[1]}
            for row in birth_countries
        ]

        # Birth locations by state
        birth_states = (
            db.query(
                Location.state,
                Location.country,
                func.count(Event.id).label("count")
            )
            .join(Event, Event.location_id == Location.id)
            .filter(
                Event.event_type_id == birth_type.id,
                Location.state.isnot(None),
                Location.state != ""
            )
            .group_by(Location.state, Location.country)
            .order_by(func.count(Event.id).desc())
            .limit(20)
            .all()
        )
        results["birth_states"] = [
            {"state": row[0], "country": row[1], "count": row[2]}
            for row in birth_states
        ]

    if death_type:
        # Death locations by country
        death_countries = (
            db.query(
                Location.country,
                func.count(Event.id).label("count")
            )
            .join(Event, Event.location_id == Location.id)
            .filter(
                Event.event_type_id == death_type.id,
                Location.country.isnot(None),
                Location.country != ""
            )
            .group_by(Location.country)
            .order_by(func.count(Event.id).desc())
            .limit(20)
            .all()
        )
        results["death_countries"] = [
            {"country": row[0], "count": row[1]}
            for row in death_countries
        ]

        # Death locations by state
        death_states = (
            db.query(
                Location.state,
                Location.country,
                func.count(Event.id).label("count")
            )
            .join(Event, Event.location_id == Location.id)
            .filter(
                Event.event_type_id == death_type.id,
                Location.state.isnot(None),
                Location.state != ""
            )
            .group_by(Location.state, Location.country)
            .order_by(func.count(Event.id).desc())
            .limit(20)
            .all()
        )
        results["death_states"] = [
            {"state": row[0], "country": row[1], "count": row[2]}
            for row in death_states
        ]

    return results


@router.get("/locations/top")
def get_top_locations(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get the most common cities and locations across all events.
    """
    # Top cities
    top_cities = (
        db.query(
            Location.city,
            Location.state,
            Location.country,
            func.count(Event.id).label("event_count")
        )
        .join(Event, Event.location_id == Location.id)
        .filter(
            Location.city.isnot(None),
            Location.city != ""
        )
        .group_by(Location.city, Location.state, Location.country)
        .order_by(func.count(Event.id).desc())
        .limit(limit)
        .all()
    )

    return {
        "top_cities": [
            {
                "city": row[0],
                "state": row[1],
                "country": row[2],
                "event_count": row[3]
            }
            for row in top_cities
        ]
    }


@router.get("/timeline/histogram")
def get_timeline_histogram(
    bucket_size: str = "decade",
    db: Session = Depends(get_db)
):
    """
    Get histogram of events over time, grouped by decade or century.

    Parameters:
    - bucket_size: "decade" or "century"
    """
    # Get all events with valid date_sort
    events = (
        db.query(Event)
        .filter(
            Event.date_sort.isnot(None),
            Event.date_sort != ""
        )
        .all()
    )

    # Group events by time bucket
    buckets: Dict[str, int] = {}

    for event in events:
        try:
            # Extract year from ISO date (YYYY-MM-DD or YYYY)
            year_str = event.date_sort.split("-")[0]
            year = int(year_str)

            if bucket_size == "century":
                century = (year // 100) * 100
                bucket_key = f"{century}s"
            else:  # decade
                decade = (year // 10) * 10
                bucket_key = f"{decade}s"

            buckets[bucket_key] = buckets.get(bucket_key, 0) + 1
        except (ValueError, IndexError):
            continue

    # Sort buckets chronologically
    sorted_buckets = sorted(
        [{"period": k, "count": v} for k, v in buckets.items()],
        key=lambda x: x["period"]
    )

    return {
        "bucket_size": bucket_size,
        "histogram": sorted_buckets
    }


@router.get("/timeline/events-by-type")
def get_events_by_type(db: Session = Depends(get_db)):
    """
    Get count of events grouped by event type.
    """
    event_counts = (
        db.query(
            EventType.code,
            EventType.label,
            EventType.color,
            func.count(Event.id).label("count")
        )
        .join(Event, Event.event_type_id == EventType.id)
        .group_by(EventType.id, EventType.code, EventType.label, EventType.color)
        .order_by(func.count(Event.id).desc())
        .all()
    )

    return {
        "event_types": [
            {
                "code": row[0],
                "label": row[1],
                "color": row[2],
                "count": row[3]
            }
            for row in event_counts
        ]
    }


@router.get("/families/size-distribution")
def get_family_size_distribution(db: Session = Depends(get_db)):
    """
    Get distribution of family sizes (number of children per family).
    """
    # Query to count children per family
    from db.models import FamilyChild

    family_sizes = (
        db.query(
            FamilyChild.family_id,
            func.count(FamilyChild.child_id).label("child_count")
        )
        .group_by(FamilyChild.family_id)
        .all()
    )

    # Create distribution
    distribution: Dict[int, int] = {}
    for _, child_count in family_sizes:
        distribution[child_count] = distribution.get(child_count, 0) + 1

    # Also count families with 0 children
    total_families = db.query(Family).count()
    families_with_children = len(family_sizes)
    distribution[0] = total_families - families_with_children

    return {
        "distribution": [
            {"children": k, "families": v}
            for k, v in sorted(distribution.items())
        ],
        "total_families": total_families,
        "avg_children": sum(k * v for k, v in distribution.items()) / total_families if total_families > 0 else 0
    }


@router.get("/demographics/gender")
def get_gender_distribution(db: Session = Depends(get_db)):
    """
    Get gender distribution across all persons.
    """
    gender_counts = (
        db.query(
            Person.sex,
            func.count(Person.id).label("count")
        )
        .filter(
            Person.sex.isnot(None),
            Person.sex != ""
        )
        .group_by(Person.sex)
        .all()
    )

    total = db.query(Person).count()

    return {
        "distribution": [
            {"sex": row[0], "count": row[1]}
            for row in gender_counts
        ],
        "total_persons": total
    }


@router.get("/lifespan/average")
def get_average_lifespan(db: Session = Depends(get_db)):
    """
    Calculate average lifespan for persons with both birth and death dates.
    """
    birth_type = db.query(EventType).filter(EventType.code == "BIRT").first()
    death_type = db.query(EventType).filter(EventType.code == "DEAT").first()

    if not birth_type or not death_type:
        return {"average_lifespan": None, "person_count": 0}

    # Get persons with both birth and death events
    from sqlalchemy import and_

    birth_events = (
        db.query(Event.person_id, Event.date_sort)
        .filter(
            Event.event_type_id == birth_type.id,
            Event.date_sort.isnot(None),
            Event.date_sort != ""
        )
        .all()
    )

    death_events = (
        db.query(Event.person_id, Event.date_sort)
        .filter(
            Event.event_type_id == death_type.id,
            Event.date_sort.isnot(None),
            Event.date_sort != ""
        )
        .all()
    )

    # Create dictionaries for lookup
    births = {pid: date for pid, date in birth_events}
    deaths = {pid: date for pid, date in death_events}

    # Calculate lifespans
    lifespans = []
    for pid in set(births.keys()) & set(deaths.keys()):
        try:
            birth_year = int(births[pid].split("-")[0])
            death_year = int(deaths[pid].split("-")[0])
            lifespan = death_year - birth_year
            if 0 <= lifespan <= 150:  # Sanity check
                lifespans.append(lifespan)
        except (ValueError, IndexError):
            continue

    if not lifespans:
        return {"average_lifespan": None, "person_count": 0}

    return {
        "average_lifespan": sum(lifespans) / len(lifespans),
        "median_lifespan": sorted(lifespans)[len(lifespans) // 2],
        "min_lifespan": min(lifespans),
        "max_lifespan": max(lifespans),
        "person_count": len(lifespans)
    }
