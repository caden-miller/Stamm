"""
Data normalizer for GEDCOM records.

Transforms raw parsed data into clean, consistent formats:
- Dates: GEDCOM date strings → (date_sort, date_end, date_precision)
- Locations: free-text → structured (city, county, state, country)
"""
import re
from datetime import date

# ---------------------------------------------------------------------------
# Date normalization
# ---------------------------------------------------------------------------

_MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

# Common GEDCOM date patterns (order matters — most specific first)
_DATE_PATTERNS = [
    # BET YYYY AND YYYY
    (re.compile(r"^BET\s+(.+?)\s+AND\s+(.+)$", re.I), "range"),
    # FROM YYYY TO YYYY
    (re.compile(r"^FROM\s+(.+?)\s+TO\s+(.+)$", re.I), "range"),
    # ABT / EST / CAL prefix
    (re.compile(r"^(?:ABT|EST|CAL)\s+(.+)$", re.I), "estimated"),
    # BEF prefix
    (re.compile(r"^BEF\s+(.+)$", re.I), "before"),
    # AFT prefix
    (re.compile(r"^AFT\s+(.+)$", re.I), "after"),
]

# Core date: "DD MON YYYY", "MON YYYY", "YYYY"
_CORE_DATE_RE = re.compile(
    r"^(?:(\d{1,2})\s+)?"     # optional day
    r"(?:([A-Z]{3})\s+)?"     # optional month
    r"(\d{3,4})$",             # year
    re.I,
)


def parse_gedcom_date(raw):
    """
    Parse a GEDCOM date string.

    Returns dict:
        date_sort:     str or None  — ISO-8601 for sorting (earliest plausible)
        date_end:      str or None  — end of range (for BET/FROM-TO)
        date_precision: str         — exact|month|year|estimated|before|after|range|unknown
    """
    if not raw or not raw.strip():
        return {"date_sort": None, "date_end": None, "date_precision": "unknown"}

    raw = raw.strip()

    # Try range/prefix patterns
    for pattern, precision in _DATE_PATTERNS:
        m = pattern.match(raw)
        if m:
            if precision == "range":
                start = _parse_core_date(m.group(1).strip())
                end = _parse_core_date(m.group(2).strip())
                return {
                    "date_sort": start,
                    "date_end": end,
                    "date_precision": "range",
                }
            else:
                core = _parse_core_date(m.group(1).strip())
                return {
                    "date_sort": core,
                    "date_end": None,
                    "date_precision": precision,
                }

    # Try plain core date
    core = _parse_core_date(raw)
    if core:
        precision = _detect_precision(raw)
        return {
            "date_sort": core,
            "date_end": None,
            "date_precision": precision,
        }

    # Unparseable — store nothing sortable
    return {"date_sort": None, "date_end": None, "date_precision": "unknown"}


def _parse_core_date(s):
    """Parse "DD MON YYYY" / "MON YYYY" / "YYYY" → ISO string or None."""
    m = _CORE_DATE_RE.match(s.strip())
    if not m:
        return None
    day_s, mon_s, year_s = m.group(1), m.group(2), m.group(3)
    year = int(year_s)
    month = _MONTHS.get(mon_s.upper(), 1) if mon_s else 1
    day = int(day_s) if day_s else 1
    # Clamp to valid range
    day = min(day, 28) if month == 2 else min(day, 31)
    try:
        d = date(year, month, day)
        return d.isoformat()
    except ValueError:
        return "{:04d}-{:02d}-{:02d}".format(year, month, 1)


def _detect_precision(raw):
    """Detect precision from a core date string (no prefix)."""
    m = _CORE_DATE_RE.match(raw.strip())
    if not m:
        return "unknown"
    day_s, mon_s, _ = m.group(1), m.group(2), m.group(3)
    if day_s and mon_s:
        return "exact"
    elif mon_s:
        return "month"
    else:
        return "year"


def date_sort_key(iso_str):
    """Convert ISO date string to a comparable tuple for sorting."""
    if not iso_str:
        return (9999, 12, 31)  # unknowns sort last
    parts = iso_str.split("-")
    try:
        return tuple(int(p) for p in parts)
    except (ValueError, IndexError):
        return (9999, 12, 31)


# ---------------------------------------------------------------------------
# Location normalization
# ---------------------------------------------------------------------------

# US state abbreviations for normalization
_US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}
_STATE_ABBREV = {v.lower(): v for v in _US_STATES.values()}
_STATE_ABBREV.update({k.lower(): v for k, v in _US_STATES.items()})


def normalize_location(raw):
    """
    Parse a GEDCOM place string into components.

    GEDCOM convention: "City, County, State, Country" (comma-separated, most→least specific).

    Returns dict:
        raw_text:   str  — original string
        normalized: str  — cleaned version
        city:       str or None
        county:     str or None
        state:      str or None
        country:    str or None
    """
    if not raw or not raw.strip():
        return None

    raw = raw.strip()
    parts = [p.strip() for p in raw.split(",") if p.strip()]

    result = {
        "raw_text": raw,
        "normalized": raw,
        "city": None,
        "county": None,
        "state": None,
        "country": None,
    }

    if len(parts) >= 4:
        result["city"] = parts[0]
        result["county"] = parts[1]
        result["state"] = parts[2]
        result["country"] = parts[3]
    elif len(parts) == 3:
        # Could be City, State, Country or City, County, State
        # Heuristic: if last part looks like a country, use City/State/Country
        last = parts[2].lower()
        if last in ("usa", "united states", "us", "canada", "england",
                     "france", "germany", "ireland", "scotland", "wales"):
            result["city"] = parts[0]
            result["state"] = parts[1]
            result["country"] = parts[2]
        else:
            result["city"] = parts[0]
            result["county"] = parts[1]
            result["state"] = parts[2]
    elif len(parts) == 2:
        result["city"] = parts[0]
        result["state"] = parts[1]
    elif len(parts) == 1:
        # Could be a state, country, or city — just store as-is
        result["city"] = parts[0]

    # Normalize state abbreviations
    if result["state"]:
        state_lower = result["state"].lower().strip()
        if state_lower in _STATE_ABBREV:
            result["state"] = _STATE_ABBREV[state_lower]

    # Build cleaned normalized string
    norm_parts = [
        p for p in [result["city"], result["county"], result["state"], result["country"]]
        if p
    ]
    result["normalized"] = ", ".join(norm_parts) if norm_parts else raw

    return result
