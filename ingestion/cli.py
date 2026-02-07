"""
CLI entry point for the ingestion pipeline.

Usage:
    python -m ingestion.cli ingest path/to/file.ged
    python -m ingestion.cli geocode [--limit N]
    python -m ingestion.cli stats
"""
import os
import sys

import click

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.models import (
    init_db, get_engine, get_session,
    Person, Event, EventType, Location, Family, Conflict,
)
from ingestion.parser import parse_gedcom
from ingestion.loader import load_gedcom
from ingestion.validator import validate_all
from ingestion.resolver import resolve_conflicts


@click.group()
def cli():
    """Stamm — GEDCOM ingestion pipeline."""
    pass


@cli.command()
@click.argument("filepath", type=click.Path(exists=True))
@click.option("--non-interactive", "-n", is_flag=True,
              help="Skip conflict resolution prompts (mark all as needs_review)")
@click.option("--skip-geocode", is_flag=True,
              help="Skip geocoding step")
@click.option("--geocode-limit", type=int, default=None,
              help="Max locations to geocode")
@click.option("--db", "db_path", type=click.Path(), default=None,
              help="Database file path (default: data/ancestry.db)")
def ingest(filepath, non_interactive, skip_geocode, geocode_limit, db_path):
    """
    Ingest a GEDCOM file.

    Parses, normalizes, loads into DB, validates, and prompts for conflict resolution.
    """
    # --- Setup ---
    engine = get_engine(db_path)
    init_db(engine)
    session = get_session(engine)

    click.echo("=" * 60)
    click.echo("  Stamm — GEDCOM Ingestion")
    click.echo("=" * 60)
    click.echo("")

    # --- Step 1: Parse ---
    click.echo("[1/4] Parsing GEDCOM file: {}".format(filepath))
    persons, families = parse_gedcom(filepath)
    click.echo("  Found {} persons, {} families".format(len(persons), len(families)))

    # Show a summary of parsed data
    for gid, p in persons.items():
        name = " ".join(filter(None, [p.get("first_name"), p.get("last_name")]))
        events_summary = ", ".join(
            e["tag"] + (":" + e["date_raw"] if e.get("date_raw") else "")
            for e in p.get("events", [])
        )
        click.echo("  {} {} [{}]".format(gid, name or "(unnamed)", events_summary))
    click.echo("")

    # --- Step 2: Load ---
    click.echo("[2/4] Loading into database...")
    stats = load_gedcom(session, persons, families)
    click.echo("")

    # --- Step 3: Validate ---
    click.echo("[3/4] Running validation rules...")
    conflict_count = validate_all(session)
    click.echo("  Found {} conflict(s)".format(conflict_count))
    click.echo("")

    # --- Step 4: Resolve conflicts ---
    if conflict_count > 0:
        click.echo("[4/4] Conflict resolution...")
        resolve_conflicts(session, non_interactive=non_interactive)
    else:
        click.echo("[4/4] No conflicts to resolve.")
    click.echo("")

    # --- Optional: Geocode ---
    if not skip_geocode:
        pending = session.query(Location).filter(
            Location.geocode_status == "pending"
        ).count()
        if pending > 0:
            click.echo("[Geocoding] {} locations pending...".format(pending))
            from ingestion.geocoder import geocode_pending
            geocode_pending(session, limit=geocode_limit)
    click.echo("")

    # --- Final summary ---
    _print_summary(session)

    session.close()
    click.echo("\nDone. Database saved to: {}".format(db_path or "data/ancestry.db"))


@cli.command()
@click.option("--limit", type=int, default=None, help="Max locations to geocode")
@click.option("--db", "db_path", type=click.Path(), default=None)
def geocode(limit, db_path):
    """Geocode pending locations."""
    engine = get_engine(db_path)
    session = get_session(engine)

    from ingestion.geocoder import geocode_pending
    geocode_pending(session, limit=limit)

    session.close()


@cli.command()
@click.option("--db", "db_path", type=click.Path(), default=None)
def stats(db_path):
    """Show database statistics."""
    engine = get_engine(db_path)
    session = get_session(engine)
    _print_summary(session)
    session.close()


@cli.command()
@click.option("--non-interactive", "-n", is_flag=True)
@click.option("--db", "db_path", type=click.Path(), default=None)
def resolve(non_interactive, db_path):
    """Re-run conflict resolution on unresolved conflicts."""
    engine = get_engine(db_path)
    session = get_session(engine)
    resolve_conflicts(session, non_interactive=non_interactive)
    session.close()


def _print_summary(session):
    """Print database statistics."""
    click.echo("=== Database Summary ===")
    click.echo("  Persons:       {}".format(session.query(Person).count()))
    click.echo("  Families:      {}".format(session.query(Family).count()))
    click.echo("  Events:        {}".format(session.query(Event).count()))
    click.echo("  Locations:     {}".format(session.query(Location).count()))

    geocoded = session.query(Location).filter(Location.geocode_status == "success").count()
    pending = session.query(Location).filter(Location.geocode_status == "pending").count()
    click.echo("  Geocoded:      {} ({} pending)".format(geocoded, pending))

    total_conflicts = session.query(Conflict).count()
    unresolved = session.query(Conflict).filter(Conflict.resolution.is_(None)).count()
    click.echo("  Conflicts:     {} ({} unresolved)".format(total_conflicts, unresolved))

    flagged = session.query(Person).filter(Person.needs_review == 1).count()
    click.echo("  Needs review:  {} person(s)".format(flagged))


if __name__ == "__main__":
    cli()
