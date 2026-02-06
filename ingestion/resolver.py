"""
Interactive CLI conflict resolver.

Presents each detected conflict to the user and records their decision.
"""
import sys
from datetime import datetime

import click

from db.models import Conflict, Event, EventType, Person


# Severity colors
_SEVERITY_COLORS = {
    "error": "red",
    "warning": "yellow",
    "info": "blue",
}


def resolve_conflicts(session, non_interactive=False):
    """
    Present unresolved conflicts to the user for resolution.

    Args:
        session: SQLAlchemy session
        non_interactive: If True, mark all as 'needs_review' without prompting

    Returns:
        dict with counts: {confirmed, rejected, needs_review, total}
    """
    conflicts = (
        session.query(Conflict)
        .filter(Conflict.resolution.is_(None))
        .order_by(Conflict.severity.desc(), Conflict.id)
        .all()
    )

    if not conflicts:
        click.echo("No conflicts to resolve.")
        return {"confirmed": 0, "rejected": 0, "needs_review": 0, "total": 0}

    click.echo("\n{} conflict(s) found.\n".format(len(conflicts)))

    stats = {"confirmed": 0, "rejected": 0, "needs_review": 0, "total": len(conflicts)}

    for i, conflict in enumerate(conflicts, 1):
        person = session.query(Person).get(conflict.person_id)
        person_name = person.display_name if person else "(unknown)"

        # Display the conflict
        severity_color = _SEVERITY_COLORS.get(conflict.severity, "white")
        click.echo("--- Conflict {}/{} ---".format(i, len(conflicts)))
        click.secho(
            "  [{severity}] {type}".format(
                severity=conflict.severity.upper(),
                type=conflict.conflict_type,
            ),
            fg=severity_color, bold=True,
        )
        click.echo("  Person:  {}".format(person_name))
        click.echo("  Detail:  {}".format(conflict.description))

        # Show involved events
        if conflict.event_id:
            evt = session.query(Event).get(conflict.event_id)
            if evt:
                et = session.query(EventType).get(evt.event_type_id)
                click.echo("  Event:   {} — {} — {}".format(
                    et.label if et else "?",
                    evt.date_raw or "(no date)",
                    evt.description or "",
                ))
        if conflict.related_event_id:
            evt2 = session.query(Event).get(conflict.related_event_id)
            if evt2:
                et2 = session.query(EventType).get(evt2.event_type_id)
                click.echo("  Related: {} — {} — {}".format(
                    et2.label if et2 else "?",
                    evt2.date_raw or "(no date)",
                    evt2.description or "",
                ))

        # Get resolution
        if non_interactive:
            resolution = "needs_review"
            click.echo("  -> Auto-marked as needs_review (non-interactive mode)")
        else:
            click.echo("")
            resolution = _prompt_resolution()

        # Apply resolution
        now = datetime.utcnow().isoformat()
        conflict.resolution = resolution
        conflict.resolved_at = now
        conflict.resolved_by = "cli"
        stats[resolution] += 1

        # If rejected, mark the event as needs_review rather than valid
        if resolution == "rejected" and conflict.event_id:
            evt = session.query(Event).get(conflict.event_id)
            if evt:
                evt.validation_status = "needs_review"
        elif resolution == "confirmed" and conflict.event_id:
            evt = session.query(Event).get(conflict.event_id)
            if evt:
                evt.validation_status = "valid"

        click.echo("")

    session.commit()

    # Update person needs_review flags
    for conflict in conflicts:
        person = session.query(Person).get(conflict.person_id)
        if person:
            still_unresolved = (
                session.query(Conflict)
                .filter(
                    Conflict.person_id == person.id,
                    Conflict.resolution.is_(None),
                )
                .count()
            )
            person.needs_review = 1 if still_unresolved > 0 else 0
    session.commit()

    # Summary
    click.echo("=== Resolution Summary ===")
    click.secho("  Confirmed:    {}".format(stats["confirmed"]), fg="green")
    click.secho("  Rejected:     {}".format(stats["rejected"]), fg="red")
    click.secho("  Needs review: {}".format(stats["needs_review"]), fg="yellow")

    return stats


def _prompt_resolution():
    """Prompt the user for a conflict resolution."""
    choices = {
        "c": "confirmed",
        "r": "rejected",
        "n": "needs_review",
    }
    while True:
        click.echo("  [c] Confirm (data is correct despite flag)")
        click.echo("  [r] Reject  (exclude or flag for correction)")
        click.echo("  [n] Needs review (decide later)")
        choice = click.prompt("  Choice", type=str, default="n").strip().lower()
        if choice in choices:
            return choices[choice]
        click.echo("  Invalid choice. Enter c, r, or n.")
