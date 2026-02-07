<div align="center">

# Stamm

### Genealogy Visualization & Exploration Tool

**GEDCOM &rarr; SQLite &rarr; FastAPI &rarr; React**

[![Python 3.7+](https://img.shields.io/badge/python-3.7+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![React 19](https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/fastapi-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![SQLite](https://img.shields.io/badge/sqlite-WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Tailwind CSS](https://img.shields.io/badge/tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

---

*Stamm* (German: "lineage, tree, root") transforms standard GEDCOM genealogy files into an interactive, visual experience &mdash; map explorations, animated timelines, family trees, analytics dashboards, and more.

</div>

<br/>

## Features

### Interactive Map & Timeline Explorer
Synchronized Leaflet map and vis-timeline showing life events across geography and time. Filter by event type, search by person, and watch history unfold with the built-in timelapse player &mdash; complete with a chat-style event log narrating births, marriages, and deaths as they happen.

### Family Tree Viewer
Select any person and expand their family connections node-by-node. Parents, spouses, and children load lazily from the API, letting you explore the tree at your own pace without overwhelming the view.

### Relationship Path Finder
Discover how any two people in your tree are connected. Uses bidirectional BFS to find the shortest relationship path and displays the chain of parent/child/spouse/sibling links between them.

### Analytics Dashboard
At-a-glance statistics and interactive charts:
- **Ancestral origins** &mdash; birth/death locations by country and state
- **Timeline histogram** &mdash; events by decade or century
- **Event distribution** &mdash; breakdown by type (births, deaths, marriages, etc.)
- **Family size** &mdash; children-per-family distribution
- **Demographics** &mdash; gender ratio across the tree
- **Lifespan analysis** &mdash; average, median, min, and max ages

### Location Management & Geocoding
Batch geocode locations via Nominatim with a streaming progress UI. Merge duplicate locations, filter by geocoding status, and see event counts per location.

### Conflict Detection & Review
Automated data quality checks flag issues like death-before-birth, multiple death records, and future dates. Resolve conflicts inline or mark people for manual review &mdash; all from a dedicated workflow page.

### Photo Gallery
Attach photos to individuals with captions, dates, and primary photo selection. View them in a carousel on each person's detail page.

### Dark & Light Theme
Full theme support with a one-click toggle. All components adapt via CSS custom properties. Preference is saved to localStorage.

---

## Architecture

```
                    ┌─────────────────────────────┐
                    │   React 19 + TypeScript      │
                    │   Vite  ·  Tailwind 4        │
                    │   Zustand  ·  React Router   │
                    │   Leaflet  ·  vis-timeline   │
                    │   Recharts                   │
                    └──────────┬──────────────────┘
                               │  /api proxy (dev)
                               ▼
                    ┌─────────────────────────────┐
                    │   FastAPI + SQLAlchemy 2     │
                    │   Pydantic · uvicorn         │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
     ┌──────────────┐  ┌────────────┐  ┌──────────────┐
     │ SQLite (WAL) │  │ Ingestion  │  │  Nominatim   │
     │ ancestry.db  │  │ CLI (Click)│  │  Geocoder    │
     └──────────────┘  └────────────┘  └──────────────┘
```

**Single-user, local-first design.** No external database, no auth, no cloud dependencies. Just your GEDCOM file and a browser.

---

## Quick Start

### Prerequisites

- Python 3.7+
- Node.js 18+
- A `.ged` GEDCOM file

### 1. Install dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### 2. Ingest your GEDCOM file

```bash
python -m ingestion.cli ingest path/to/family.ged
```

This runs the full pipeline: parse &rarr; normalize &rarr; load &rarr; validate &rarr; resolve conflicts &rarr; geocode locations.

<details>
<summary><strong>CLI options</strong></summary>

| Flag | Description |
|------|-------------|
| `--non-interactive` / `-n` | Skip conflict prompts, mark all as needs_review |
| `--skip-geocode` | Skip the geocoding step |
| `--geocode-limit N` | Limit geocoding to N locations |
| `--db PATH` | Custom database file path |

</details>

### 3. Build the frontend

```bash
cd frontend && npm run build
```

### 4. Start the server

```bash
python start.py
```

Open **http://localhost:8000** in your browser.

<details>
<summary><strong>Server options</strong></summary>

| Flag | Description |
|------|-------------|
| `--port N` | Custom port (default: 8000) |
| `--host HOST` | Bind address (default: 0.0.0.0) |
| `--build` | Rebuild frontend before starting |
| `--ingest FILE` | Ingest a GEDCOM file then start |

</details>

### Development mode

Run the backend and frontend dev server separately for hot reload:

```bash
# Terminal 1 — API server
python start.py

# Terminal 2 — Vite dev server (proxies /api → localhost:8000)
cd frontend && npm run dev
```

Then open **http://localhost:5173**.

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Stats cards, analytics charts, quick actions |
| **Explorer** | `/explore` | Map + timeline + timelapse with event chat |
| **People** | `/people` | Searchable person directory |
| **Person Detail** | `/people/:id` | Bio, events, families, photos, conflicts |
| **Ancestry** | `/ancestry` | Family tree explorer + path finder |
| **Locations** | `/locations` | Location management + batch geocoding |
| **Conflicts** | `/conflicts` | Conflict resolution + needs-review queue |

---

## API Reference

Full interactive docs available at **http://localhost:8000/docs** (Swagger UI) when the server is running.

<details>
<summary><strong>Endpoint overview</strong></summary>

### Persons
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/persons` | List persons (search, pagination, needs_review filter) |
| `GET` | `/api/persons/{id}` | Person detail |
| `GET` | `/api/persons/{id}/events` | Person's events |
| `PATCH` | `/api/persons/{id}/review` | Mark person reviewed/unreviewed |

### Timeline & Map
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/timeline` | vis-timeline formatted events |
| `GET` | `/api/locations/geojson` | GeoJSON FeatureCollection |

### Ancestry
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ancestry/persons/{id}/family` | Immediate family (parents, spouses, children) |
| `GET` | `/api/ancestry/persons/{id}/ancestors` | Ancestor tree (configurable generations) |
| `GET` | `/api/ancestry/persons/{id}/descendants` | Descendant tree (configurable generations) |
| `GET` | `/api/ancestry/persons/{a}/path/{b}` | Shortest relationship path |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/origins` | Birth/death locations by country/state |
| `GET` | `/api/analytics/locations/top` | Most common locations |
| `GET` | `/api/analytics/timeline/histogram` | Events by decade/century |
| `GET` | `/api/analytics/timeline/events-by-type` | Event type distribution |
| `GET` | `/api/analytics/families/size-distribution` | Children per family |
| `GET` | `/api/analytics/demographics/gender` | Gender ratio |
| `GET` | `/api/analytics/lifespan/average` | Lifespan statistics |

### Locations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/locations` | List with geocode status filter |
| `GET` | `/api/locations/geocode/stream` | SSE geocoding progress |
| `POST` | `/api/locations/merge` | Merge duplicate locations |

### Conflicts & Photos
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/conflicts` | List conflicts |
| `PATCH` | `/api/conflicts/{id}` | Resolve a conflict |
| `POST` | `/api/persons/{id}/photos` | Upload a photo |
| `GET` | `/api/persons/{id}/photos` | List photos |

</details>

---

## Ingestion Pipeline

```
  GEDCOM file
       │
       ▼
  ┌─────────┐     ┌────────────┐     ┌────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
  │  Parse   │────▶│ Normalize  │────▶│  Load  │────▶│ Validate │────▶│ Resolve │────▶│ Geocode  │
  │ parser.py│     │normalizer.py│    │loader.py│    │validator.py│   │resolver.py│   │geocoder.py│
  └─────────┘     └────────────┘     └────────┘     └──────────┘     └─────────┘     └──────────┘
       │                │                 │               │                │               │
   GEDCOM text    Standardize dates   4-pass insert   Detect conflicts  Interactive    Nominatim API
   → Python       "ABT 1842" → ISO   with location   death<birth,      or auto-mark   1 req / 1.1s
     dicts        + locations         deduplication   future dates...   needs_review
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| **State** | Zustand 5 |
| **Routing** | React Router 6 |
| **Map** | Leaflet 1.9 + react-leaflet 5 + MarkerCluster |
| **Timeline** | vis-timeline 8.5 |
| **Charts** | Recharts 3.7 |
| **API** | FastAPI, Pydantic, SQLAlchemy 2 |
| **Database** | SQLite (WAL mode) |
| **Ingestion CLI** | Click 8 |
| **Geocoding** | Nominatim (OpenStreetMap) |
| **Server** | uvicorn |

---

## Project Structure

```
stamm/
├── api/                    # FastAPI backend
│   ├── main.py             # App setup, CORS, SPA catch-all
│   ├── deps.py             # Database session dependency
│   ├── schemas.py          # Pydantic request/response models
│   └── routes/             # Route modules
│       ├── persons.py      # Person CRUD + review
│       ├── events.py       # Events + event types
│       ├── timeline.py     # Timeline data (vis-timeline format)
│       ├── locations.py    # Locations, GeoJSON, geocoding, merge
│       ├── conflicts.py    # Conflict resolution
│       ├── ancestry.py     # Family tree, ancestors, descendants, path
│       ├── analytics.py    # Statistical analysis endpoints
│       ├── upload.py       # GEDCOM file upload
│       └── photos.py       # Photo management
├── db/
│   ├── models.py           # SQLAlchemy ORM models + init_db()
│   └── schema.sql          # Reference schema (not used at runtime)
├── ingestion/
│   ├── cli.py              # Click CLI commands
│   ├── parser.py           # GEDCOM parsing
│   ├── normalizer.py       # Date/location normalization
│   ├── loader.py           # Database loading
│   ├── validator.py        # Data validation
│   ├── resolver.py         # Conflict resolution
│   └── geocoder.py         # Nominatim geocoding
├── frontend/
│   ├── index.html          # Vite entry point
│   ├── vite.config.ts      # Vite config (proxy, aliases)
│   └── src/
│       ├── App.tsx          # Route definitions
│       ├── store.ts         # Zustand global store
│       ├── index.css        # Theme variables + Tailwind
│       ├── hooks/           # useTheme
│       ├── api/             # Types + fetch client
│       ├── pages/           # Route page components
│       └── components/      # Reusable UI components
├── data/                   # Database + GEDCOM files (gitignored)
├── start.py                # Single-command server startup
├── requirements.txt        # Python dependencies
└── CLAUDE.md               # AI assistant context
```

---

## Database Schema

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `person` | Individuals | gedcom_id, first/last/maiden name, sex, needs_review |
| `family` | Marriages/partnerships | husband_id, wife_id |
| `family_child` | Parent-child links | family_id, child_id |
| `event` | Life events | person_id, event_type_id, location_id, date_sort, date_raw |
| `event_type` | Event definitions | code (BIRT/DEAT/MARR/...), label, color |
| `location` | Places | raw_text, normalized, lat/lng, geocode_status |
| `conflict` | Data quality issues | conflict_type, severity, resolution |
| `person_photo` | Photo attachments | person_id, file_path, caption, is_primary |

---

## Additional CLI Commands

```bash
# Geocode pending locations (with optional limit)
python -m ingestion.cli geocode --limit 100

# View database statistics
python -m ingestion.cli stats

# Re-run conflict resolution on unresolved conflicts
python -m ingestion.cli resolve
python -m ingestion.cli resolve --non-interactive
```

---

<div align="center">

Built with FastAPI, React, and SQLite

*Stamm &mdash; because every family has a story worth exploring.*

</div>
