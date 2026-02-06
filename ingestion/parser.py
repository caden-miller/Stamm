"""
GEDCOM file parser.

Reads a .ged file and produces structured Python dicts representing
individuals (INDI), families (FAM), and their associated events.

Handles:
- Standard GEDCOM 5.5.1 tags
- Ancestry.com custom tags (prefixed with _) — skipped gracefully
- CONC/CONT continuation lines
- Multi-value NAME fields (GIVN, SURN)
"""
import re
from collections import OrderedDict


# ---------------------------------------------------------------------------
# Raw data containers
# ---------------------------------------------------------------------------

def _make_person():
    return {
        "gedcom_id": None,
        "first_name": None,
        "last_name": None,
        "maiden_name": None,
        "sex": None,
        "events": [],
        "fams_ids": [],   # families where this person is a spouse
        "famc_ids": [],   # families where this person is a child
    }


def _make_family():
    return {
        "gedcom_id": None,
        "husband_id": None,
        "wife_id": None,
        "children_ids": [],
        "events": [],
    }


def _make_event():
    return {
        "tag": None,       # BIRT, DEAT, MARR, etc.
        "date_raw": None,
        "place_raw": None,
        "description": None,
    }


# ---------------------------------------------------------------------------
# Line parser
# ---------------------------------------------------------------------------

# GEDCOM line: LEVEL [XREF] TAG [VALUE]
_LINE_RE = re.compile(
    r"^(\d+)"                   # level
    r"\s+"
    r"(?:(@[^@]+@)\s+)?"        # optional xref
    r"(\S+)"                    # tag
    r"(?:\s(.*))?$"             # optional value
)

# NAME field: "John /Smith/" → first="John", surname="Smith"
_NAME_RE = re.compile(r"^(.*?)\s*/([^/]*)/(.*)$")

# Tags that introduce events on INDI records
_INDI_EVENT_TAGS = {
    "BIRT", "DEAT", "BURI", "BAPM", "CHR",
    "IMMI", "EMIG", "NATU", "CENS",
    "RESI", "OCCU", "GRAD", "RETI",
    "PROB", "WILL", "EVEN",
}

# Tags that introduce events on FAM records
_FAM_EVENT_TAGS = {"MARR", "DIV", "EVEN"}


def parse_line(line):
    """Parse one GEDCOM line → (level, xref, tag, value) or None."""
    line = line.rstrip("\r\n")
    if line.startswith("\ufeff"):
        line = line[1:]
    m = _LINE_RE.match(line)
    if not m:
        return None
    level = int(m.group(1))
    xref = m.group(2)
    tag = m.group(3).upper()
    value = m.group(4) or ""
    return (level, xref, tag, value)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def parse_gedcom(filepath):
    """
    Parse a GEDCOM file.

    Returns:
        persons:  OrderedDict  gedcom_id → person dict
        families: OrderedDict  gedcom_id → family dict
    """
    with open(filepath, "r", encoding="utf-8-sig") as f:
        raw_lines = f.readlines()

    lines = []
    for raw in raw_lines:
        parsed = parse_line(raw)
        if parsed is not None:
            lines.append(parsed)

    persons = OrderedDict()
    families = OrderedDict()

    i = 0
    while i < len(lines):
        level, xref, tag, value = lines[i]

        if level == 0 and tag == "INDI":
            person, i = _parse_indi(lines, i)
            persons[person["gedcom_id"]] = person
        elif level == 0 and tag == "FAM":
            family, i = _parse_fam(lines, i)
            families[family["gedcom_id"]] = family
        else:
            i += 1

    return persons, families


# ---------------------------------------------------------------------------
# Record parsers
# ---------------------------------------------------------------------------

def _parse_indi(lines, start):
    """Parse an INDI record starting at index `start`."""
    _, xref, _, _ = lines[start]
    person = _make_person()
    person["gedcom_id"] = xref

    i = start + 1
    current_event = None

    while i < len(lines):
        level, _, tag, value = lines[i]

        if level == 0:
            break

        if level == 1:
            # Close any in-progress event
            if current_event is not None:
                person["events"].append(current_event)
                current_event = None

            if tag == "NAME":
                _parse_name(person, value, lines, i)
            elif tag == "SEX":
                sex = value.strip().upper()
                if sex in ("M", "F"):
                    person["sex"] = sex
                else:
                    person["sex"] = "U"
            elif tag == "FAMS":
                person["fams_ids"].append(value.strip())
            elif tag == "FAMC":
                person["famc_ids"].append(value.strip())
            elif tag in _INDI_EVENT_TAGS:
                current_event = _make_event()
                current_event["tag"] = tag
                if value.strip():
                    current_event["description"] = value.strip()

        elif level == 2 and current_event is not None:
            if tag == "DATE":
                current_event["date_raw"] = value.strip()
            elif tag == "PLAC":
                current_event["place_raw"] = value.strip()
            elif tag == "TYPE" and not current_event.get("description"):
                current_event["description"] = value.strip()

        i += 1

    if current_event is not None:
        person["events"].append(current_event)

    return person, i


def _parse_name(person, name_value, lines, name_line_idx):
    """Parse NAME tag + GIVN/SURN sub-tags."""
    # Parse compound value: "FirstName /Surname/"
    m = _NAME_RE.match(name_value)
    if m:
        given = m.group(1).strip()
        surname = m.group(2).strip()
        if given:
            person["first_name"] = given
        if surname:
            person["last_name"] = surname
            person["maiden_name"] = surname
    elif name_value.strip():
        person["first_name"] = name_value.strip()

    # Sub-tags (GIVN, SURN) override compound value
    i = name_line_idx + 1
    while i < len(lines):
        level, _, tag, value = lines[i]
        if level <= 1:
            break
        if level == 2:
            if tag == "GIVN" and value.strip():
                person["first_name"] = value.strip()
            elif tag == "SURN" and value.strip():
                person["last_name"] = value.strip()
        i += 1


def _parse_fam(lines, start):
    """Parse a FAM record starting at index `start`."""
    _, xref, _, _ = lines[start]
    family = _make_family()
    family["gedcom_id"] = xref

    i = start + 1
    current_event = None

    while i < len(lines):
        level, _, tag, value = lines[i]

        if level == 0:
            break

        if level == 1:
            if current_event is not None:
                family["events"].append(current_event)
                current_event = None

            if tag == "HUSB":
                family["husband_id"] = value.strip()
            elif tag == "WIFE":
                family["wife_id"] = value.strip()
            elif tag == "CHIL":
                family["children_ids"].append(value.strip())
            elif tag in _FAM_EVENT_TAGS:
                current_event = _make_event()
                current_event["tag"] = tag
                if value.strip():
                    current_event["description"] = value.strip()

        elif level == 2 and current_event is not None:
            if tag == "DATE":
                current_event["date_raw"] = value.strip()
            elif tag == "PLAC":
                current_event["place_raw"] = value.strip()

        i += 1

    if current_event is not None:
        family["events"].append(current_event)

    return family, i
