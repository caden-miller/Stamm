# Data Model — Entity Relationships

## ER Diagram (Text)

```
┌──────────────┐       ┌──────────────┐
│  event_type  │       │   location   │
│──────────────│       │──────────────│
│ id       PK  │       │ id       PK  │
│ code         │       │ raw_text     │
│ label        │       │ normalized   │
│ color        │       │ city/state/  │
│ sort_order   │       │   country    │
└──────┬───────┘       │ lat/lng      │
       │               │ geocode_stat │
       │ 1:N           └──────┬───────┘
       │                      │
       │                      │ 1:N
       ▼                      ▼
┌──────────────────────────────────────┐
│               event                  │
│──────────────────────────────────────│
│ id            PK                     │
│ person_id     FK → person            │
│ family_id     FK → family (nullable) │
│ event_type_id FK → event_type        │
│ location_id   FK → location          │
│ date_raw / date_sort / date_end      │
│ date_precision                       │
│ validation_status                    │
│ confidence                           │
└───────────┬──────────────────────────┘
            │
            │ N:1
            ▼
┌──────────────────┐         ┌───────────────────┐
│     person       │         │    conflict        │
│──────────────────│         │───────────────────│
│ id           PK  │◄────────│ person_id     FK  │
│ gedcom_id        │         │ event_id      FK  │
│ first_name       │         │ related_event FK  │
│ last_name        │         │ conflict_type     │
│ maiden_name      │         │ severity          │
│ sex              │         │ resolution        │
│ needs_review     │         │ description       │
└────────┬─────────┘         └───────────────────┘
         │
         │ N:M (via family)
         ▼
┌──────────────────┐       ┌────────────────────┐
│     family       │       │   family_child     │
│──────────────────│       │────────────────────│
│ id           PK  │◄──────│ family_id     FK   │
│ gedcom_id        │       │ child_id      FK → │
│ husband_id   FK  │       │   person           │
│ wife_id      FK  │       │ relationship       │
└──────────────────┘       └────────────────────┘
```

## Table Purposes

| Table          | Purpose                                                    |
|----------------|------------------------------------------------------------|
| `event_type`   | Reference table. Defines GEDCOM event codes + display info |
| `location`     | Deduplicated locations. Geocoded asynchronously             |
| `person`       | One row per individual in the GEDCOM file                  |
| `family`       | One row per FAM record — links spouses                     |
| `family_child` | Join table linking families to their children              |
| `event`        | Core table. Every life event (birth, death, marriage, etc) |
| `conflict`     | Validation failures. Tracks type, severity, and resolution |

## Date Handling Strategy

GEDCOM dates are notoriously inconsistent. Examples from real files:

| GEDCOM Raw        | date_sort    | date_end     | date_precision |
|-------------------|--------------|--------------|----------------|
| `12 JUN 1776`     | `1776-06-12` | NULL         | `exact`        |
| `JUN 1776`        | `1776-06-01` | NULL         | `month`        |
| `1776`            | `1776-01-01` | NULL         | `year`         |
| `ABT 1842`        | `1842-01-01` | NULL         | `estimated`    |
| `BEF MAR 1900`    | `1900-03-01` | NULL         | `before`       |
| `AFT 1865`        | `1865-01-01` | NULL         | `after`        |
| `BET 1840 AND 1845`| `1840-01-01`| `1845-01-01` | `range`        |
| (empty)           | NULL         | NULL         | `unknown`      |

**Sorting rule**: `date_sort` is always the earliest plausible date. This allows correct ordering even for imprecise dates. The frontend uses `date_precision` to display appropriately (e.g., "~1842" for estimated, "before March 1900" for BEF).

## Location Handling Strategy

GEDCOM location strings vary wildly:

```
"Springfield, Sangamon, Illinois, USA"
"Springfield, IL"
"Illinois"
"Unknown"
""
```

**Approach**:
1. Store `raw_text` exactly as found in the GEDCOM
2. Parse into components (city/county/state/country) using comma-splitting + heuristics
3. Geocode via Nominatim in a separate batch step
4. Failed geocodes get `geocode_status = 'failed'` and are skipped on the map (not lost)

## Conflict Types

| conflict_type              | Rule                                                        | Severity |
|---------------------------|-------------------------------------------------------------|----------|
| `death_before_birth`      | Death date_sort < birth date_sort                           | error    |
| `multiple_deaths`         | More than one DEAT event for a person                       | error    |
| `event_after_death`       | Any non-burial event with date_sort > death date_sort       | warning  |
| `overlapping_marriages`   | Two MARR events without intervening DIV or DEAT of spouse   | warning  |
| `marriage_without_divorce`| Second MARR found without DIV record for prior marriage     | warning  |
| `impossible_date`         | date_sort parses to an invalid calendar date                | error    |
| `future_date`             | date_sort > current date                                    | warning  |
| `negative_age`            | Computed age at event is negative                           | error    |
| `duplicate_event`         | Same person + same event type + same date + same location   | info     |

## Index Strategy

Indexes are designed around the three primary access patterns:

1. **Timeline queries**: "Give me all events in [date range] of type [X]"
   → `idx_event_type_date` (compound: event_type_id + date_sort)

2. **Person detail**: "Show me all events for person [Y]"
   → `idx_event_person_id`

3. **Map rendering**: "Give me all events with coordinates"
   → `idx_location_coords` (partial: WHERE latitude IS NOT NULL)

4. **Conflict triage**: "Show me unresolved conflicts"
   → `idx_conflict_unresolved` (partial: WHERE resolution IS NULL)

Partial indexes (WHERE clauses) keep the index small by excluding rows that don't match the common query pattern.
