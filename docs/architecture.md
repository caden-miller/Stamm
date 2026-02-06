# Ancestry Viewer — System Architecture

## System Diagram (Text)

```
┌─────────────────────────────────────────────────────────────┐
│                        USER                                 │
│   (uploads .ged file via CLI, views results in browser)     │
└──────┬──────────────────────────────────────┬───────────────┘
       │ CLI                                  │ Browser
       ▼                                      ▼
┌──────────────────┐                ┌────────────────────────┐
│  Ingestion CLI   │                │   React Frontend       │
│  (Python)        │                │                        │
│                  │                │  ┌──────────────────┐  │
│  ┌────────────┐  │                │  │ Timeline (scroll)│  │
│  │ Parser     │  │                │  └──────────────────┘  │
│  │ Normalizer │  │                │  ┌──────────────────┐  │
│  │ Validator  │  │                │  │ Map (Leaflet)    │  │
│  │ Resolver   │  │                │  └──────────────────┘  │
│  │ Loader     │  │                │  ┌──────────────────┐  │
│  └────────────┘  │                │  │ Conflict Panel   │  │
│        │         │                │  └──────────────────┘  │
└────────┼─────────┘                └───────────┬────────────┘
         │                                      │
         │ SQLAlchemy                            │ HTTP/JSON
         ▼                                      ▼
┌──────────────────┐                ┌────────────────────────┐
│   SQLite DB      │◄───────────────│   FastAPI Backend      │
│   (→ Postgres)   │  SQLAlchemy    │                        │
│                  │                │  /api/persons           │
│  persons         │                │  /api/events            │
│  events          │                │  /api/timeline          │
│  locations       │                │  /api/conflicts         │
│  conflicts       │                │  /api/locations         │
│  families        │                │                        │
└──────────────────┘                └────────────────────────┘
```

## Data Flow

1. **Ingest**: User runs CLI → parses .ged → normalizes → validates → prompts on conflicts → writes to SQLite
2. **Serve**: FastAPI reads SQLite → exposes REST endpoints → returns GeoJSON-compatible responses
3. **View**: React app fetches API → renders synchronized timeline + map → highlights conflicts

## Tech Stack

| Layer       | Technology             | Justification                                                |
|-------------|------------------------|--------------------------------------------------------------|
| Ingestion   | Python 3.11+           | Best GEDCOM library ecosystem; clean text processing         |
| GEDCOM Parse| `python-gedcom-parser` | Maintained fork; handles messy real-world files              |
| ORM         | SQLAlchemy 2.0         | Migration-friendly (Alembic); works with SQLite and Postgres |
| Database    | SQLite (→ Postgres)    | Zero-config start; same SQL dialect via SQLAlchemy           |
| Backend     | FastAPI                | Async, auto-docs (Swagger), Pydantic validation              |
| Frontend    | React 18 + TypeScript  | Component model fits timeline+map+panel layout               |
| Timeline    | vis-timeline           | Mature, scrollable, zoomable; handles sparse date ranges     |
| Map         | Leaflet + react-leaflet| Free, no API key, solid tile sources (OSM)                   |
| Styling     | Tailwind CSS           | Utility-first; fast prototyping without fighting CSS          |
| Geocoding   | Nominatim (OSM)        | Free; rate-limited but sufficient for batch geocoding         |
| Build       | Vite                   | Fast dev server and builds for React                         |

### Why NOT alternatives

- **Mapbox**: Requires API key and has usage limits. Leaflet + OSM tiles are free and sufficient.
- **D3 for timeline**: Too low-level for this. vis-timeline gives scroll/zoom out of the box.
- **Django**: Heavier than needed. FastAPI is lighter and the auto-generated docs are useful for debugging.
- **MongoDB**: Genealogy data is highly relational (person→events→locations, person↔person). SQL is the right fit.

## Module Boundaries

Each module has a single responsibility and communicates through well-defined interfaces:

### `ingestion/` — Python CLI pipeline
- **parser.py**: Reads .ged file → produces raw Python dicts of individuals, families, events
- **normalizer.py**: Cleans dates (partial/fuzzy), normalizes location strings, standardizes IDs
- **validator.py**: Applies conflict-detection rules, returns list of `Conflict` objects
- **resolver.py**: Interactive CLI prompts — user confirms, rejects, or flags each conflict
- **geocoder.py**: Batch-geocodes location strings via Nominatim (with caching + rate limiting)
- **loader.py**: Writes validated/flagged records into the database via SQLAlchemy

### `db/` — Database layer
- **models.py**: SQLAlchemy ORM models (Person, Event, Location, EventType, Conflict, Family)
- **schema.sql**: Raw SQL for reference / manual setup
- **seed.py**: Inserts default event types and test data
- **migrations/**: Alembic migration scripts (generated, not handwritten)

### `api/` — FastAPI backend
- **main.py**: App factory, CORS, lifespan
- **routes/persons.py**: CRUD + search for persons
- **routes/events.py**: Events with filtering (time range, type, person)
- **routes/timeline.py**: Aggregated timeline data (optimized for vis-timeline format)
- **routes/locations.py**: GeoJSON endpoint for map markers
- **routes/conflicts.py**: List/resolve conflicts
- **schemas.py**: Pydantic response/request models

### `frontend/` — React + TypeScript
- **components/Timeline.tsx**: vis-timeline wrapper, scroll/zoom, event click
- **components/MapView.tsx**: Leaflet map, markers colored by event type
- **components/ConflictPanel.tsx**: Sidebar listing flagged items
- **components/PersonDetail.tsx**: Modal/panel showing all events for a person
- **components/FilterBar.tsx**: Toggle event types, search persons
- **hooks/useTimeline.ts**: State management for current time window
- **hooks/useMapSync.ts**: Keeps map and timeline in sync
- **api/client.ts**: Typed fetch wrappers for backend endpoints

## Key Design Decisions

1. **Partial dates stored as text**: GEDCOM dates like "ABT 1842" or "BEF MAR 1900" cannot be represented as SQL DATE. We store `date_raw` (original), `date_sort` (best-guess ISO for ordering), and `date_precision` (enum).

2. **Locations are a separate table**: Many events share the same location string. Deduplicating into a `locations` table lets us geocode once and reuse.

3. **Conflicts are explicit records**: Rather than a boolean flag, each conflict gets its own row with type, description, and resolution status. This supports an audit trail.

4. **Families as join table**: GEDCOM models families (FAM records) with husband/wife/children. We preserve this structure rather than flattening to parent-child pairs, because GEDCOM data references family IDs.

5. **Geocoding is deferred**: The ingestion pipeline stores raw location text immediately. Geocoding runs as a separate step (or background task) so ingestion doesn't block on network calls.

6. **Frontend reads only**: The React app is read-only. Conflict resolution happens in the CLI during ingestion. A future phase could add browser-based resolution.
