"""
FastAPI application.

Development:  uvicorn api.main:app --reload --port 8000
Production:   python start.py
"""
import os
import sys

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.deps import startup
from api.routes import persons, events, timeline, locations, conflicts, ancestry, upload, analytics
from api.schemas import StatsOut
from db.models import Person, Family, Event, Location, Conflict

# Path to the built frontend
FRONTEND_DIST = os.path.join(_project_root, "frontend", "dist")


def create_app():
    app = FastAPI(
        title="Stamm API",
        description="REST API for genealogical data from GEDCOM files",
        version="0.1.0",
    )

    # CORS — allow dev servers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup():
        startup()

    # ---- API routes ----
    app.include_router(persons.router)
    app.include_router(events.router)
    app.include_router(timeline.router)
    app.include_router(locations.router)
    app.include_router(conflicts.router)
    app.include_router(ancestry.router)
    app.include_router(upload.router)
    app.include_router(analytics.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/stats", response_model=StatsOut)
    def stats():
        from api.deps import get_db
        db = next(get_db())
        try:
            return StatsOut(
                persons=db.query(Person).count(),
                families=db.query(Family).count(),
                events=db.query(Event).count(),
                locations=db.query(Location).count(),
                locations_geocoded=db.query(Location).filter(
                    Location.geocode_status == "success"
                ).count(),
                locations_pending=db.query(Location).filter(
                    Location.geocode_status == "pending"
                ).count(),
                conflicts_total=db.query(Conflict).count(),
                conflicts_unresolved=db.query(Conflict).filter(
                    Conflict.resolution.is_(None)
                ).count(),
                persons_needing_review=db.query(Person).filter(
                    Person.needs_review == 1
                ).count(),
            )
        finally:
            db.close()

    # ---- Serve built frontend (production) ----
    if os.path.isdir(FRONTEND_DIST):
        # Serve static assets (JS, CSS, images)
        app.mount(
            "/assets",
            StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")),
            name="static-assets",
        )

        # SPA catch-all: any non-API route returns index.html
        @app.get("/{full_path:path}")
        def serve_spa(full_path: str):
            # Don't intercept API routes
            if full_path.startswith("api/"):
                return None
            file_path = os.path.join(FRONTEND_DIST, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    return app


app = create_app()
