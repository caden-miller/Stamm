"""
Database loader.

Takes parsed/normalized GEDCOM data and writes it to the database.
Handles deduplication of locations and maps GEDCOM IDs to database IDs.
"""
import click

from db.models import (
    Person, Family, FamilyChild, Event, EventType, Location,
    init_db, get_session,
)
from ingestion.normalizer import parse_gedcom_date, normalize_location


def load_gedcom(session, persons, families):
    """
    Load parsed GEDCOM data into the database.

    Args:
        session: SQLAlchemy session
        persons: OrderedDict of gedcom_id → person dict (from parser)
        families: OrderedDict of gedcom_id → family dict (from parser)

    Returns:
        dict with load stats
    """
    stats = {
        "persons": 0,
        "families": 0,
        "events": 0,
        "locations": 0,
    }

    # Pre-load event type lookup
    type_lookup = {}
    for et in session.query(EventType).all():
        type_lookup[et.code] = et.id

    # Track GEDCOM ID → database ID mappings
    person_id_map = {}   # gedcom_id → db person.id
    location_cache = {}  # raw_text → db location.id

    # --- Pass 1: Load persons ---
    click.echo("Loading {} persons...".format(len(persons)))
    for gedcom_id, pdata in persons.items():
        db_person = Person(
            gedcom_id=gedcom_id,
            first_name=pdata.get("first_name"),
            last_name=pdata.get("last_name"),
            maiden_name=pdata.get("maiden_name"),
            sex=pdata.get("sex"),
        )
        session.add(db_person)
        session.flush()  # Get the auto-generated ID
        person_id_map[gedcom_id] = db_person.id
        stats["persons"] += 1

    # --- Pass 2: Load families ---
    family_id_map = {}  # gedcom_id → db family.id
    click.echo("Loading {} families...".format(len(families)))
    for gedcom_id, fdata in families.items():
        husband_db_id = person_id_map.get(fdata.get("husband_id"))
        wife_db_id = person_id_map.get(fdata.get("wife_id"))

        db_family = Family(
            gedcom_id=gedcom_id,
            husband_id=husband_db_id,
            wife_id=wife_db_id,
        )
        session.add(db_family)
        session.flush()
        family_id_map[gedcom_id] = db_family.id
        stats["families"] += 1

        # Link children
        for child_gedcom_id in fdata.get("children_ids", []):
            child_db_id = person_id_map.get(child_gedcom_id)
            if child_db_id:
                fc = FamilyChild(
                    family_id=db_family.id,
                    child_id=child_db_id,
                )
                session.add(fc)

    # --- Pass 3: Load events (from persons) ---
    click.echo("Loading events...")
    for gedcom_id, pdata in persons.items():
        db_person_id = person_id_map[gedcom_id]
        for raw_event in pdata.get("events", []):
            _load_event(
                session, raw_event, db_person_id, None,
                type_lookup, location_cache, stats,
            )

    # --- Pass 4: Load events (from families) ---
    # Family events (MARR, DIV) are stored as events on BOTH spouses
    for gedcom_id, fdata in families.items():
        db_family_id = family_id_map[gedcom_id]
        husband_db_id = person_id_map.get(fdata.get("husband_id"))
        wife_db_id = person_id_map.get(fdata.get("wife_id"))
        spouse_ids = [sid for sid in [husband_db_id, wife_db_id] if sid]

        for raw_event in fdata.get("events", []):
            for spouse_id in spouse_ids:
                _load_event(
                    session, raw_event, spouse_id, db_family_id,
                    type_lookup, location_cache, stats,
                )

    session.commit()

    click.echo(
        "Loaded: {persons} persons, {families} families, "
        "{events} events, {locations} unique locations".format(**stats)
    )
    return stats


def _load_event(session, raw_event, person_id, family_id,
                type_lookup, location_cache, stats):
    """Create a single Event record from raw parsed event data."""
    tag = raw_event.get("tag", "EVEN")
    event_type_id = type_lookup.get(tag)
    if not event_type_id:
        # Fall back to generic "Other Event"
        event_type_id = type_lookup.get("EVEN")
    if not event_type_id:
        return  # Can't store without a type

    # Normalize date
    date_info = parse_gedcom_date(raw_event.get("date_raw"))

    # Normalize and deduplicate location
    location_id = None
    place_raw = raw_event.get("place_raw")
    if place_raw:
        location_id = _get_or_create_location(session, place_raw, location_cache, stats)

    db_event = Event(
        person_id=person_id,
        family_id=family_id,
        event_type_id=event_type_id,
        location_id=location_id,
        date_raw=raw_event.get("date_raw"),
        date_sort=date_info["date_sort"],
        date_end=date_info["date_end"],
        date_precision=date_info["date_precision"],
        validation_status="unvalidated",
        description=raw_event.get("description"),
    )
    session.add(db_event)
    stats["events"] += 1


def _get_or_create_location(session, raw_text, cache, stats):
    """Return location ID, creating the record if needed."""
    if raw_text in cache:
        return cache[raw_text]

    # Check DB for existing
    existing = session.query(Location).filter(Location.raw_text == raw_text).first()
    if existing:
        cache[raw_text] = existing.id
        return existing.id

    # Create new
    loc_data = normalize_location(raw_text)
    if not loc_data:
        return None

    db_loc = Location(
        raw_text=loc_data["raw_text"],
        normalized=loc_data["normalized"],
        city=loc_data.get("city"),
        county=loc_data.get("county"),
        state=loc_data.get("state"),
        country=loc_data.get("country"),
        geocode_status="pending",
    )
    session.add(db_loc)
    session.flush()
    cache[raw_text] = db_loc.id
    stats["locations"] += 1
    return db_loc.id
