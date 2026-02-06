"""
Batch geocoder using OpenStreetMap Nominatim.

Geocodes location strings that have geocode_status='pending'.
Respects Nominatim rate limits (1 request per second).
"""
import time
import json
from urllib.request import urlopen, Request
from urllib.error import URLError
from urllib.parse import quote

import click

from db.models import Location

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "AncestryViewer/1.0 (genealogy research tool)"
RATE_LIMIT_SECONDS = 1.1  # Slightly over 1s to be safe


def geocode_pending(session, limit=None):
    """
    Geocode all locations with status='pending'.

    Args:
        session: SQLAlchemy session
        limit: Max number of locations to geocode (None = all)

    Returns:
        dict with counts: {success, failed, skipped, total}
    """
    query = session.query(Location).filter(Location.geocode_status == "pending")
    if limit:
        query = query.limit(limit)
    locations = query.all()

    if not locations:
        click.echo("No pending locations to geocode.")
        return {"success": 0, "failed": 0, "skipped": 0, "total": 0}

    click.echo("Geocoding {} locations (this respects Nominatim rate limits)...".format(
        len(locations)
    ))

    stats = {"success": 0, "failed": 0, "skipped": 0, "total": len(locations)}

    for i, loc in enumerate(locations, 1):
        search_text = loc.normalized or loc.raw_text
        if not search_text or search_text.lower() in ("unknown", ""):
            loc.geocode_status = "skipped"
            stats["skipped"] += 1
            continue

        click.echo("  [{}/{}] {}".format(i, len(locations), search_text), nl=False)

        coords = _geocode_single(search_text)
        if coords:
            loc.latitude, loc.longitude = coords
            loc.geocode_status = "success"
            stats["success"] += 1
            click.echo(" -> {:.4f}, {:.4f}".format(coords[0], coords[1]))
        else:
            loc.geocode_status = "failed"
            stats["failed"] += 1
            click.echo(" -> FAILED")

        # Rate limit
        if i < len(locations):
            time.sleep(RATE_LIMIT_SECONDS)

    session.commit()

    click.echo(
        "Geocoding complete: {success} success, {failed} failed, {skipped} skipped".format(
            **stats
        )
    )
    return stats


def _geocode_single(search_text):
    """
    Geocode a single location string via Nominatim.

    Returns (latitude, longitude) or None.
    """
    url = "{}?q={}&format=json&limit=1".format(
        NOMINATIM_URL, quote(search_text)
    )
    req = Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and len(data) > 0:
                return (float(data[0]["lat"]), float(data[0]["lon"]))
    except (URLError, ValueError, KeyError, IndexError):
        pass

    return None
