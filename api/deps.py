"""
Shared dependencies for API routes.
"""
import os
import sys

# Ensure project root is importable
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from db.models import get_engine, get_session, init_db

# Module-level engine (created once, reused)
_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = get_engine()
    return _engine


def startup():
    """Called on app startup — ensures DB and tables exist."""
    init_db(_get_engine())


def get_db():
    """FastAPI dependency — yields a SQLAlchemy session per request."""
    session = get_session(_get_engine())
    try:
        yield session
    finally:
        session.close()
