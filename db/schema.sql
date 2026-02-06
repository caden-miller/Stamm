-- Ancestry Viewer — Database Schema
-- Target: SQLite (compatible with Postgres via SQLAlchemy)
-- Convention: snake_case, singular table names, explicit FKs

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- EVENT TYPES (reference table)
-- ============================================================
CREATE TABLE event_type (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,  -- GEDCOM tag: BIRT, DEAT, MARR, etc.
    label       TEXT    NOT NULL,         -- Human-readable: "Birth", "Death", etc.
    color       TEXT    NOT NULL,         -- Hex color for frontend rendering
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Seed event types
INSERT INTO event_type (code, label, color, sort_order) VALUES
    ('BIRT', 'Birth',       '#22c55e', 1),   -- green
    ('DEAT', 'Death',       '#ef4444', 2),   -- red
    ('MARR', 'Marriage',    '#3b82f6', 3),   -- blue
    ('DIV',  'Divorce',     '#8b5cf6', 4),   -- purple
    ('IMMI', 'Immigration', '#f97316', 5),   -- orange
    ('EMIG', 'Emigration',  '#f97316', 6),   -- orange
    ('BURI', 'Burial',      '#6b7280', 7),   -- gray
    ('CENS', 'Census',      '#06b6d4', 8),   -- cyan
    ('RESI', 'Residence',   '#eab308', 9),   -- yellow
    ('NATU', 'Naturalization','#f97316',10),  -- orange
    ('OCCU', 'Occupation',  '#a855f7', 11),  -- violet
    ('BAPM', 'Baptism',     '#14b8a6', 12),  -- teal
    ('CHR',  'Christening', '#14b8a6', 13),  -- teal
    ('PROB', 'Probate',     '#6b7280', 14),  -- gray
    ('WILL', 'Will',        '#6b7280', 15),  -- gray
    ('GRAD', 'Graduation',  '#a855f7', 16),  -- violet
    ('RETI', 'Retirement',  '#a855f7', 17),  -- violet
    ('EVEN', 'Other Event', '#9ca3af', 99);  -- light gray (catch-all)

-- ============================================================
-- LOCATION (deduplicated, geocoded separately)
-- ============================================================
CREATE TABLE location (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text        TEXT    NOT NULL,         -- Original string from GEDCOM
    normalized      TEXT,                     -- Cleaned/standardized version
    city            TEXT,
    county          TEXT,
    state           TEXT,
    country         TEXT,
    latitude        REAL,                     -- NULL until geocoded
    longitude       REAL,                     -- NULL until geocoded
    geocode_status  TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (geocode_status IN ('pending', 'success', 'failed', 'skipped')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),

    UNIQUE(raw_text)                          -- Prevent duplicate location strings
);

-- ============================================================
-- PERSON
-- ============================================================
CREATE TABLE person (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    gedcom_id       TEXT    NOT NULL UNIQUE,  -- e.g., "@I123@"
    first_name      TEXT,
    last_name       TEXT,
    maiden_name     TEXT,                     -- Maiden/birth surname if different
    sex             TEXT    CHECK (sex IN ('M', 'F', 'U')),
    needs_review    INTEGER NOT NULL DEFAULT 0,  -- 1 = flagged for human review
    notes           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- FAMILY (models GEDCOM FAM records)
-- ============================================================
CREATE TABLE family (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    gedcom_id       TEXT    NOT NULL UNIQUE,  -- e.g., "@F45@"
    husband_id      INTEGER REFERENCES person(id) ON DELETE SET NULL,
    wife_id         INTEGER REFERENCES person(id) ON DELETE SET NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- FAMILY_CHILD (children belonging to a family)
-- ============================================================
CREATE TABLE family_child (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id       INTEGER NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    child_id        INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    relationship    TEXT    NOT NULL DEFAULT 'biological'
                    CHECK (relationship IN ('biological', 'adopted', 'step', 'foster', 'unknown')),

    UNIQUE(family_id, child_id)
);

-- ============================================================
-- EVENT
-- ============================================================
CREATE TABLE event (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id       INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    family_id       INTEGER REFERENCES family(id) ON DELETE SET NULL,  -- For family events (MARR, DIV)
    event_type_id   INTEGER NOT NULL REFERENCES event_type(id),
    location_id     INTEGER REFERENCES location(id) ON DELETE SET NULL,

    -- Date handling: GEDCOM dates are messy.
    -- We store three representations:
    date_raw        TEXT,           -- Original GEDCOM string: "ABT 1842", "BEF MAR 1900", "12 JUN 1776"
    date_sort       TEXT,           -- Best-guess ISO-8601 for sorting: "1842-01-01", "1900-03-01"
    date_end        TEXT,           -- For ranges: "BET 1840 AND 1845" → date_sort=1840, date_end=1845
    date_precision  TEXT    NOT NULL DEFAULT 'unknown'
                    CHECK (date_precision IN (
                        'exact',       -- Full date known: "12 JUN 1776"
                        'month',       -- Month+year: "MAR 1900"
                        'year',        -- Year only: "1842"
                        'estimated',   -- ABT, EST, CAL prefixes
                        'before',      -- BEF prefix
                        'after',       -- AFT prefix
                        'range',       -- BET ... AND ...
                        'unknown'      -- No date at all
                    )),

    validation_status TEXT  NOT NULL DEFAULT 'unvalidated'
                    CHECK (validation_status IN (
                        'valid',       -- Passed all checks
                        'conflict',    -- Failed validation, conflict record exists
                        'needs_review',-- User deferred decision
                        'unvalidated'  -- Not yet checked
                    )),

    confidence      REAL    DEFAULT NULL,  -- 0.0–1.0, NULL if not assessed
    description     TEXT,                  -- Free-text note on the event
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CONFLICT (explicit conflict/flag records)
-- ============================================================
CREATE TABLE conflict (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id       INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    event_id        INTEGER REFERENCES event(id) ON DELETE SET NULL,       -- The event that triggered the conflict (if applicable)
    related_event_id INTEGER REFERENCES event(id) ON DELETE SET NULL,      -- The other event involved (if applicable)

    conflict_type   TEXT    NOT NULL
                    CHECK (conflict_type IN (
                        'death_before_birth',
                        'multiple_deaths',
                        'event_after_death',
                        'overlapping_marriages',
                        'marriage_without_divorce',
                        'impossible_date',
                        'future_date',
                        'negative_age',
                        'duplicate_event',
                        'other'
                    )),

    description     TEXT    NOT NULL,       -- Human-readable explanation
    severity        TEXT    NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('error', 'warning', 'info')),

    resolution      TEXT    DEFAULT NULL
                    CHECK (resolution IS NULL OR resolution IN (
                        'confirmed',    -- User confirmed data is correct despite flag
                        'rejected',     -- User rejected the flagged data
                        'needs_review', -- User deferred
                        'auto_fixed'    -- System corrected automatically
                    )),

    resolved_at     TEXT,
    resolved_by     TEXT,                  -- "cli", "web", or a user identifier
    notes           TEXT,                  -- User's note on resolution

    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Person lookups
CREATE INDEX idx_person_gedcom_id   ON person(gedcom_id);
CREATE INDEX idx_person_last_name   ON person(last_name);
CREATE INDEX idx_person_needs_review ON person(needs_review) WHERE needs_review = 1;

-- Event queries (the most frequent access pattern)
CREATE INDEX idx_event_person_id    ON event(person_id);
CREATE INDEX idx_event_type_id      ON event(event_type_id);
CREATE INDEX idx_event_date_sort    ON event(date_sort);
CREATE INDEX idx_event_location_id  ON event(location_id);
CREATE INDEX idx_event_validation   ON event(validation_status) WHERE validation_status != 'valid';
CREATE INDEX idx_event_family_id    ON event(family_id);

-- Compound index for timeline queries: "events of type X in date range Y"
CREATE INDEX idx_event_type_date    ON event(event_type_id, date_sort);

-- Location lookups
CREATE INDEX idx_location_geocode   ON location(geocode_status) WHERE geocode_status = 'pending';
CREATE INDEX idx_location_coords    ON location(latitude, longitude) WHERE latitude IS NOT NULL;

-- Family lookups
CREATE INDEX idx_family_husband     ON family(husband_id);
CREATE INDEX idx_family_wife        ON family(wife_id);
CREATE INDEX idx_family_child_family ON family_child(family_id);
CREATE INDEX idx_family_child_child  ON family_child(child_id);

-- Conflict lookups
CREATE INDEX idx_conflict_person_id ON conflict(person_id);
CREATE INDEX idx_conflict_type      ON conflict(conflict_type);
CREATE INDEX idx_conflict_unresolved ON conflict(resolution) WHERE resolution IS NULL;

-- ============================================================
-- VIEWS (convenience queries)
-- ============================================================

-- Full event view with person name, event type, and location
CREATE VIEW v_event_detail AS
SELECT
    e.id            AS event_id,
    p.id            AS person_id,
    p.first_name,
    p.last_name,
    et.code         AS event_code,
    et.label        AS event_label,
    et.color        AS event_color,
    e.date_raw,
    e.date_sort,
    e.date_end,
    e.date_precision,
    e.validation_status,
    l.normalized    AS location_name,
    l.latitude,
    l.longitude,
    l.geocode_status
FROM event e
JOIN person p       ON e.person_id = p.id
JOIN event_type et  ON e.event_type_id = et.id
LEFT JOIN location l ON e.location_id = l.id;

-- Unresolved conflicts with person context
CREATE VIEW v_unresolved_conflict AS
SELECT
    c.id            AS conflict_id,
    c.conflict_type,
    c.severity,
    c.description,
    p.id            AS person_id,
    p.first_name,
    p.last_name,
    e1.date_raw     AS event_date,
    e2.date_raw     AS related_event_date
FROM conflict c
JOIN person p       ON c.person_id = p.id
LEFT JOIN event e1  ON c.event_id = e1.id
LEFT JOIN event e2  ON c.related_event_id = e2.id
WHERE c.resolution IS NULL;

-- Timeline-ready: events with coordinates for map overlay
CREATE VIEW v_geo_events AS
SELECT
    e.id            AS event_id,
    p.id            AS person_id,
    p.first_name || ' ' || p.last_name AS person_name,
    et.code         AS event_code,
    et.label        AS event_label,
    et.color,
    e.date_sort,
    e.date_precision,
    l.latitude,
    l.longitude,
    l.normalized    AS location_name
FROM event e
JOIN person p       ON e.person_id = p.id
JOIN event_type et  ON e.event_type_id = et.id
JOIN location l     ON e.location_id = l.id
WHERE l.latitude IS NOT NULL
ORDER BY e.date_sort;
