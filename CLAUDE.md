# CLAUDE.md — Stamm

## What This Is

Stamm (German: "ancestry/lineage") is a genealogy visualization tool: GEDCOM files → SQLite → FastAPI → React UI with synchronized timeline, interactive map, timelapse playback, analytics dashboard, and family tree exploration.

## Architecture

```
React 19 (Vite, port 5173) → FastAPI (port 8000) → SQLite (data/ancestry.db)
                                                      ↑
                                Ingestion CLI (Click) ─┘
```

- **Frontend**: React 19 + TypeScript 5.9 + Tailwind 4 + Zustand + React Router + Leaflet + vis-timeline + Recharts
- **API**: FastAPI + SQLAlchemy 2 + Pydantic
- **DB**: SQLite (WAL mode), ORM models in `db/models.py`
- **Ingestion**: Click CLI — `python -m ingestion.cli ingest <file.ged>`
- **Startup**: `python start.py` (serves API + built frontend on single port)
- **Python**: 3.7+ (no walrus operators or 3.8+ features)

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
  main.py            # FastAPI app, CORS, SPA catch-all, /api/health, /api/stats
  deps.py            # get_db() → yields SQLAlchemy Session per request
  schemas.py         # All Pydantic models (request/response)
  routes/
    persons.py       # GET /api/persons, /{id}, /{id}/events, PATCH /{id}/review
    events.py        # GET /api/events, /events/types, /{id}
    timeline.py      # GET /api/timeline → vis-timeline compatible JSON
    locations.py     # GET /api/locations, /geojson, /geocode/stream (SSE), POST /merge
    conflicts.py     # GET /api/conflicts, GET/{id}, PATCH/{id} (resolve)
    ancestry.py      # GET /api/ancestry/persons/{id}/ancestors|descendants|family|path/{id}
    analytics.py     # GET /api/analytics/* (origins, demographics, lifespan, histogram, etc.)
    upload.py        # POST /api/upload/gedcom (background ingestion)
    photos.py        # GET/PATCH/DELETE /api/photos/{id}

db/
  models.py          # SQLAlchemy ORM: EventType, Location, Person, Family,
                     #   FamilyChild, Event, Conflict, PersonPhoto + init_db() + seed_event_types()
  schema.sql         # Reference SQL schema with indexes (not used at runtime)

ingestion/
  cli.py             # Click CLI: ingest, geocode, stats, resolve
  parser.py          # GEDCOM → OrderedDict of persons + families
  normalizer.py      # parse_gedcom_date(), normalize_location()
  loader.py          # load_gedcom() → inserts persons/families/events/locations
  validator.py       # validate_all() → creates Conflict records
  resolver.py        # Interactive CLI conflict resolution prompts
  geocoder.py        # Nominatim batch geocoding (1.1s rate limit)

frontend/src/
  main.tsx                    # React root with BrowserRouter
  App.tsx                     # Route definitions, loading screen, theme init
  store.ts                    # Zustand global store (persons, stats, conflicts, eventTypes)
  index.css                   # Tailwind imports + CSS variables (dark/light theme)
  hooks/
    useTheme.ts               # Dark/light theme toggle with localStorage persistence
  api/
    types.ts                  # TypeScript interfaces (mirrors Pydantic schemas)
    client.ts                 # 40+ typed fetch wrappers with 10-min localStorage cache
  pages/
    Layout.tsx                # App shell: header, nav, search, theme toggle, stats badge
    DashboardPage.tsx         # Analytics charts + quick stats + actions
    ExplorerPage.tsx          # Map + timeline + timelapse + event chat panel
    PeoplePage.tsx            # Person directory with search/pagination
    PersonPage.tsx            # Person detail: bio, events, families, photos
    AncestryPage.tsx          # Family tree explorer + relationship path finder
    LocationsPage.tsx         # Location management, geocoding, merging
    ConflictsPage.tsx         # Conflict resolution + needs-review workflow
  components/
    MapView.tsx               # Leaflet map with GeoJSON
    ClusteredMarkers.tsx      # Marker clustering layer
    Timeline.tsx              # vis-timeline wrapper
    TimelapseControls.tsx     # Play/pause/seek/speed
    PlaybackDateDisplay.tsx   # Current date overlay during timelapse
    PulseLayer.tsx            # Animated expanding rings on map
    EventChatPanel.tsx        # Chat-style event log during timelapse
    FilterBar.tsx             # Event type toggles + search
    PersonList.tsx            # Scrollable person sidebar
    PersonDetail.tsx          # Person info card
    ConflictPanel.tsx         # Conflict list (resolved/unresolved)
    PhotoGallery.tsx          # Photo carousel with upload/edit/delete
    AncestryTree.tsx          # Ancestor/descendant tree visualization
    FamilyTreeView.tsx        # Interactive expandable family tree
    LocationMergeModal.tsx    # Duplicate location merge UI
```

## Routes (Frontend)

| Path | Page | Description |
|------|------|-------------|
| `/` | DashboardPage | Analytics, stats, quick actions |
| `/explore` | ExplorerPage | Map + timeline + timelapse |
| `/people` | PeoplePage | Person directory |
| `/people/:personId` | PersonPage | Person detail view |
| `/ancestry` | AncestryPage | Family tree + path finder (tabs) |
| `/locations` | LocationsPage | Location management + geocoding |
| `/conflicts` | ConflictsPage | Conflict resolution + needs review |

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
| `person_photo` | person_id, file_path, url, caption, date_taken, is_primary, sort_order | Photo attachments |

## API Endpoints

### Persons
```
GET    /api/persons?search=&limit=500&offset=0&needs_review=true
GET    /api/persons/{id}
GET    /api/persons/{id}/events
GET    /api/persons/{id}/photos
POST   /api/persons/{id}/photos          (multipart upload)
PATCH  /api/persons/{id}/review          { reviewed: bool }
```

### Events & Timeline
```
GET    /api/events?person_id=&event_type=&date_from=&date_to=
GET    /api/events/types
GET    /api/timeline?event_types=BIRT,DEAT&person_ids=1,2&date_from=&date_to=
```

### Locations & GeoJSON
```
GET    /api/locations?geocode_status=pending&search=&limit=&offset=
GET    /api/locations/geojson?event_types=&person_ids=&date_from=&date_to=
GET    /api/locations/geocode/stream?limit=100     (SSE)
POST   /api/locations/merge                        { source_ids: [], target_id: int }
```

### Ancestry
```
GET    /api/ancestry/persons/{id}/ancestors?generations=3
GET    /api/ancestry/persons/{id}/descendants?generations=3
GET    /api/ancestry/persons/{id}/family           (parents, spouses, children)
GET    /api/ancestry/persons/{person1_id}/path/{person2_id}
```

### Analytics
```
GET    /api/analytics/origins
GET    /api/analytics/locations/top?limit=10
GET    /api/analytics/timeline/histogram?bucket_size=decade
GET    /api/analytics/timeline/events-by-type
GET    /api/analytics/families/size-distribution
GET    /api/analytics/demographics/gender
GET    /api/analytics/lifespan/average
```

### Conflicts & Stats
```
GET    /api/conflicts?unresolved_only=false
PATCH  /api/conflicts/{id}                         { resolution, notes }
GET    /api/stats
GET    /api/health
```

### Upload
```
POST   /api/upload/gedcom                          (multipart .ged file)
```

## Frontend State (Zustand)

Global store in `store.ts`:
- `persons` — preloaded 500 person summaries (fetched on init)
- `eventTypes` — all event type definitions
- `stats` — aggregate counts (persons, events, locations, conflicts, etc.)
- `conflicts` — conflict list
- `initialize()` — parallel fetch of all core data on mount
- `refreshStats()` / `refreshConflicts()` — targeted refresh after mutations

## Theming

Dark/light theme via CSS custom properties on `:root` / `[data-theme="light"]`:
- Toggle in header (sun/moon icon)
- Persisted in `localStorage` key `av-theme`
- Applied via `document.documentElement.dataset.theme`
- All components use CSS variables: `--bg-deep`, `--bg-card`, `--text-primary`, `--gold`, etc.

## Ingestion Pipeline

1. **Parse** (`parser.py`) — GEDCOM text → Python dicts
2. **Normalize** (`normalizer.py`) — Standardize dates ("ABT 1842" → ISO) and locations
3. **Load** (`loader.py`) — Insert persons → families → events (4-pass, deduplicates locations)
4. **Validate** (`validator.py`) — Detect conflicts (death<birth, multiple deaths, future dates, etc.)
5. **Resolve** (`resolver.py`) — Interactive CLI or auto-mark needs_review if `--non-interactive`
6. **Geocode** (`geocoder.py`) — Optional, Nominatim API, rate-limited (1 req/1.1s)

## Key Conventions

- **Python 3.7+**: No walrus operators (`:=`), no 3.8+ syntax. snake_case files/vars, singular table names
- **TypeScript**: PascalCase components, camelCase vars, types mirror Pydantic schemas
- **DB**: All timestamps stored as ISO strings. `date_sort` (ISO) for ordering, `date_raw` preserves original
- **State**: Zustand store for global data; page-local state via `useState`
- **Routing**: React Router DOM with URL-based navigation
- **Caching**: API client uses 10-min localStorage cache for read-only endpoints (prefix `av:`)
- **No env vars** — DB path hardcoded to `data/ancestry.db`
- **Vite proxy**: `/api` → `http://localhost:8000` in dev mode
- `.gitignore`: GEDCOM files and ancestry DB files in `data/`

## Known Limitations

- N+1 queries in person list (event count per person in loop)
- No eager loading on ORM relationships
- No frontend error boundary (API errors throw)
- No auth/sessions (designed for single-user local use)
- Geocoder uses free Nominatim (1 req/1.1s rate limit)
- No Alembic migrations (schema changes require manual DB rebuild)
- Bundle size warning (~1.1MB main chunk, could benefit from code splitting)
