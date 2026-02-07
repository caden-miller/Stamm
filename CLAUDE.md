# CLAUDE.md — Ancestry Viewer

## What This Is

Genealogy visualization tool: GEDCOM files → SQLite → FastAPI → React UI with synchronized timeline + map + timelapse playback.

## Architecture

```
React (Vite, port 5173) → FastAPI (port 8000) → SQLite (data/ancestry.db)
                                                  ↑
                            Ingestion CLI (Click) ─┘
```

- **Frontend**: React 19 + TypeScript + Tailwind 4 + Leaflet (map) + vis-timeline
- **API**: FastAPI + SQLAlchemy 2 + Pydantic
- **DB**: SQLite (WAL mode), ORM models in `db/models.py`
- **Ingestion**: Click CLI — `python -m ingestion.cli ingest <file.ged>`
- **Startup**: `python start.py` (serves API + built frontend)

## Commands

```bash
# Backend
pip install -r requirements.txt
python -m ingestion.cli ingest path/to/file.ged   # full pipeline
python -m ingestion.cli geocode --limit 100        # batch geocode locations
python -m ingestion.cli stats                       # DB summary
python start.py [--port 8000] [--build] [--ingest FILE]

# Frontend
cd frontend && npm install
npm run dev      # dev server (proxies /api → localhost:8000)
npm run build    # production build → frontend/dist/
npm run lint
```

## File Map

```
api/
  main.py          # FastAPI app, CORS, SPA catch-all, /api/health, /api/stats
  deps.py          # get_db() → yields SQLAlchemy Session per request
  schemas.py       # All Pydantic models (request/response)
  routes/
    persons.py     # GET /api/persons, /api/persons/{id}, /api/persons/{id}/events
    events.py      # GET /api/events, /api/events/types, /api/events/{id}
    timeline.py    # GET /api/timeline → vis-timeline compatible JSON
    locations.py   # GET /api/locations, /api/locations/geojson → GeoJSON
    conflicts.py   # GET /api/conflicts, GET/{id}, PATCH/{id} (resolve)

db/
  models.py        # SQLAlchemy ORM: EventType, Location, Person, Family,
                   #   FamilyChild, Event, Conflict + init_db() + seed_event_types()
  schema.sql       # Reference SQL schema with indexes (not used at runtime)

ingestion/
  cli.py           # Click CLI: ingest, geocode, stats, resolve
  parser.py        # GEDCOM → OrderedDict of persons + families
  normalizer.py    # parse_gedcom_date(), normalize_location()
  loader.py        # load_gedcom() → inserts persons/families/events/locations
  validator.py     # validate_all() → creates Conflict records
  resolver.py      # Interactive CLI conflict resolution prompts
  geocoder.py      # Nominatim batch geocoding (1.1s rate limit)

frontend/src/
  main.tsx                  # React root
  App.tsx                   # ALL state lives here, timelapse engine, layout
  index.css                 # Tailwind imports + custom styles
  api/types.ts              # TypeScript interfaces (mirrors Pydantic schemas)
  api/client.ts             # Typed fetch wrappers for all endpoints
  components/
    FilterBar.tsx            # Event type toggles + search + stats
    PersonList.tsx           # Scrollable sidebar list
    PersonDetail.tsx         # Person detail + events + families
    ConflictPanel.tsx        # Conflict list grouped by resolved/unresolved
    MapView.tsx              # Leaflet map with GeoJSON CircleMarkers
    Timeline.tsx             # vis-timeline wrapper
    TimelapseControls.tsx    # Play/pause/seek/speed
    PulseLayer.tsx           # Animated expanding rings on map
```

## Database Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `person` | gedcom_id, first_name, last_name, maiden_name, sex, needs_review | `display_name` property |
| `family` | gedcom_id, husband_id (FK→person), wife_id (FK→person) | |
| `family_child` | family_id, child_id, relationship_type | UNIQUE(family_id, child_id) |
| `event` | person_id, family_id, event_type_id, location_id, date_raw, date_sort, date_end, date_precision, validation_status, confidence | date_sort = earliest plausible ISO date |
| `event_type` | code, label, color, sort_order | Seeded: BIRT, DEAT, MARR, DIV, etc. |
| `location` | raw_text (UNIQUE), normalized, city/county/state/country, lat/lng, geocode_status | |
| `conflict` | person_id, event_id, related_event_id, conflict_type, severity, resolution | Types: death_before_birth, multiple_deaths, etc. |

## API Query Patterns

- Pagination: `limit` + `offset` params (no cursor)
- Filters: `search`, `person_id`, `event_type`, `date_from`/`date_to`, `validation_status`, `geocode_status`
- Timeline/GeoJSON: `event_types` and `person_ids` as comma-separated strings
- DI: `db: Session = Depends(get_db)` on every route
- Conflict resolution: PATCH `/api/conflicts/{id}` with `{resolution, notes}`

## Ingestion Pipeline Order

1. **Parse** (`parser.py`) — GEDCOM text → Python dicts
2. **Normalize** (`normalizer.py`) — Standardize dates ("ABT 1842" → ISO) and locations
3. **Load** (`loader.py`) — Insert persons → families → events (4-pass, deduplicates locations)
4. **Validate** (`validator.py`) — Detect conflicts (death<birth, multiple deaths, future dates, etc.)
5. **Resolve** (`resolver.py`) — Interactive CLI or auto-mark needs_review if `--non-interactive`
6. **Geocode** (`geocoder.py`) — Optional, Nominatim API, rate-limited

## Frontend State Model

All state in `App.tsx`, passed via props (no Context/Redux). Key state:
- `eventTypes`, `persons`, `stats`, `conflicts` — core data fetched on mount
- `activeTypes`, `searchQuery` — filter controls
- `timelineData`, `geoData` — visualization data (refetched on filter change)
- `selectedPersonId`, `selectedEventId`, `personDetail` — selection
- `isPlaying`, `playbackIndex`, `playbackSpeed`, `visibleEventIds`, `pulsingEvents` — timelapse
- Sidebar views: `persons` | `detail` | `conflicts` (state-based, no URL routing)

## Key Conventions

- **Python**: snake_case files/vars, singular table names (`person` not `persons`)
- **TypeScript**: PascalCase components, camelCase vars, types mirror Pydantic schemas
- **DB**: All timestamps stored as ISO strings. Dates use `date_sort` (ISO) for ordering, `date_raw` preserves original
- **No env vars** — DB path hardcoded to `data/ancestry.db`
- **No error boundary** in frontend — API errors throw
- **Vite proxy**: `/api` → `http://localhost:8000` in dev mode
- `.gitignore`: `data/Miller Family Tree.ged`, `data/ancestry*`

## Known Limitations

- N+1 queries in person list (event count per person in loop)
- No eager loading on relationships
- No frontend error handling UI (crashes on API failure)
- No auth/sessions
- Geocoder uses free Nominatim (1 req/1.1s)
- No Alembic migrations configured (mentioned in docs but not set up)
