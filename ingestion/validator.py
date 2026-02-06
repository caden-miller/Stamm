"""
Conflict detection for genealogical data.

Applies rules to detect logically inconsistent or suspicious events
after they have been loaded into the database.
"""
from datetime import date

from db.models import Person, Event, EventType, Conflict


def validate_all(session):
    """
    Run all validation rules against every person in the database.

    Returns the number of new conflicts created.
    """
    persons = session.query(Person).all()
    # Build event_type code lookup
    type_map = {}
    for et in session.query(EventType).all():
        type_map[et.id] = et.code

    total = 0
    for person in persons:
        events = session.query(Event).filter(Event.person_id == person.id).all()
        conflicts = _validate_person(person, events, type_map)
        for c in conflicts:
            session.add(c)
            total += 1

    if total > 0:
        # Mark events involved in conflicts
        for c in session.query(Conflict).filter(Conflict.resolution.is_(None)).all():
            if c.event_id:
                evt = session.query(Event).get(c.event_id)
                if evt:
                    evt.validation_status = "conflict"
            if c.related_event_id:
                evt = session.query(Event).get(c.related_event_id)
                if evt:
                    evt.validation_status = "conflict"
        # Flag persons with unresolved conflicts
        for person in persons:
            has_conflict = session.query(Conflict).filter(
                Conflict.person_id == person.id,
                Conflict.resolution.is_(None),
            ).count() > 0
            person.needs_review = 1 if has_conflict else 0

        session.commit()

    return total


def _validate_person(person, events, type_map):
    """Run all rules for a single person. Returns list of Conflict objects."""
    conflicts = []

    # Categorize events by type code
    by_type = {}
    for e in events:
        code = type_map.get(e.event_type_id, "EVEN")
        by_type.setdefault(code, []).append(e)

    birth_events = by_type.get("BIRT", [])
    death_events = by_type.get("DEAT", [])
    marriage_events = by_type.get("MARR", [])
    divorce_events = by_type.get("DIV", [])

    birth_date = _earliest_sort_date(birth_events)
    death_date = _earliest_sort_date(death_events)

    # Rule: Multiple death events
    if len(death_events) > 1:
        conflicts.append(Conflict(
            person_id=person.id,
            event_id=death_events[0].id,
            related_event_id=death_events[1].id,
            conflict_type="multiple_deaths",
            description="{} has {} death records".format(
                person.display_name, len(death_events)
            ),
            severity="error",
        ))

    # Rule: Death before birth
    if birth_date and death_date and death_date < birth_date:
        conflicts.append(Conflict(
            person_id=person.id,
            event_id=death_events[0].id if death_events else None,
            related_event_id=birth_events[0].id if birth_events else None,
            conflict_type="death_before_birth",
            description="{}: death ({}) is before birth ({})".format(
                person.display_name, death_date, birth_date
            ),
            severity="error",
        ))

    # Rule: Events after death
    if death_date:
        for e in events:
            code = type_map.get(e.event_type_id, "EVEN")
            if code in ("DEAT", "BURI", "PROB", "WILL"):
                continue  # These are expected after/at death
            if e.date_sort and e.date_sort > death_date:
                conflicts.append(Conflict(
                    person_id=person.id,
                    event_id=e.id,
                    related_event_id=death_events[0].id if death_events else None,
                    conflict_type="event_after_death",
                    description="{}: {} ({}) occurs after death ({})".format(
                        person.display_name, code, e.date_sort, death_date
                    ),
                    severity="warning",
                ))

    # Rule: Future dates
    today = date.today().isoformat()
    for e in events:
        if e.date_sort and e.date_sort > today:
            conflicts.append(Conflict(
                person_id=person.id,
                event_id=e.id,
                conflict_type="future_date",
                description="{}: {} date {} is in the future".format(
                    person.display_name,
                    type_map.get(e.event_type_id, "event"),
                    e.date_sort,
                ),
                severity="warning",
            ))

    # Rule: Marriage without divorce (overlapping marriages)
    if len(marriage_events) > 1:
        sorted_marriages = sorted(marriage_events, key=lambda e: e.date_sort or "")
        divorce_dates = sorted(
            [e.date_sort for e in divorce_events if e.date_sort],
        )
        for idx in range(len(sorted_marriages) - 1):
            m1 = sorted_marriages[idx]
            m2 = sorted_marriages[idx + 1]
            # Check if there's a divorce between these two marriages
            m1_date = m1.date_sort or ""
            m2_date = m2.date_sort or ""
            has_intervening_divorce = any(
                m1_date <= d <= m2_date for d in divorce_dates
            )
            if not has_intervening_divorce:
                conflicts.append(Conflict(
                    person_id=person.id,
                    event_id=m2.id,
                    related_event_id=m1.id,
                    conflict_type="marriage_without_divorce",
                    description="{}: marriage ({}) without divorce after prior marriage ({})".format(
                        person.display_name, m2_date, m1_date,
                    ),
                    severity="warning",
                ))

    # Rule: Duplicate events (same type + same date + same location)
    seen = {}
    for e in events:
        key = (e.event_type_id, e.date_sort, e.location_id)
        if key in seen and e.date_sort:  # Only flag if there's a date to compare
            conflicts.append(Conflict(
                person_id=person.id,
                event_id=e.id,
                related_event_id=seen[key].id,
                conflict_type="duplicate_event",
                description="{}: duplicate {} event on {}".format(
                    person.display_name,
                    type_map.get(e.event_type_id, "event"),
                    e.date_sort,
                ),
                severity="info",
            ))
        else:
            seen[key] = e

    return conflicts


def _earliest_sort_date(events):
    """Return the earliest date_sort string from a list of events, or None."""
    dates = [e.date_sort for e in events if e.date_sort]
    return min(dates) if dates else None
