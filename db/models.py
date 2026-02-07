"""
SQLAlchemy ORM models — maps to db/schema.sql.
"""
import os
from datetime import datetime

from sqlalchemy import (
    Column, Integer, Text, Float, ForeignKey, UniqueConstraint,
    CheckConstraint, Index, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()

# ---------------------------------------------------------------------------
# Database connection helpers
# ---------------------------------------------------------------------------

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ancestry.db")


def get_engine(db_path=None):
    path = db_path or DB_PATH
    engine = create_engine(
        "sqlite:///" + path,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    # Enable WAL mode and foreign keys for SQLite
    from sqlalchemy import event as sa_event

    @sa_event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def get_session(engine=None):
    eng = engine or get_engine()
    return sessionmaker(bind=eng)()


def init_db(engine=None):
    """Create all tables and seed event types."""
    eng = engine or get_engine()
    Base.metadata.create_all(eng)
    session = sessionmaker(bind=eng)()
    _seed_event_types(session)
    session.close()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class EventType(Base):
    __tablename__ = "event_type"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(Text, nullable=False, unique=True)
    label = Column(Text, nullable=False)
    color = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    events = relationship("Event", back_populates="event_type")

    def __repr__(self):
        return "<EventType {} {}>".format(self.code, self.label)


class Location(Base):
    __tablename__ = "location"

    id = Column(Integer, primary_key=True, autoincrement=True)
    raw_text = Column(Text, nullable=False, unique=True)
    normalized = Column(Text)
    city = Column(Text)
    county = Column(Text)
    state = Column(Text)
    country = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    geocode_status = Column(
        Text, nullable=False, default="pending",
        info={"check": "pending|success|failed|skipped"},
    )
    created_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())

    events = relationship("Event", back_populates="location")

    def __repr__(self):
        return "<Location {}>".format(self.normalized or self.raw_text)


class Person(Base):
    __tablename__ = "person"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gedcom_id = Column(Text, nullable=False, unique=True)
    first_name = Column(Text)
    last_name = Column(Text)
    maiden_name = Column(Text)
    sex = Column(Text)
    needs_review = Column(Integer, nullable=False, default=0)
    notes = Column(Text)
    profile_image = Column(Text)  # URL or file path to profile image
    biography = Column(Text)  # Extended biography text
    created_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())

    events = relationship("Event", back_populates="person", cascade="all, delete-orphan")
    conflicts = relationship("Conflict", back_populates="person", cascade="all, delete-orphan")

    @property
    def display_name(self):
        parts = [p for p in [self.first_name, self.last_name] if p]
        return " ".join(parts) if parts else "(Unknown)"

    def __repr__(self):
        return "<Person {} {}>".format(self.gedcom_id, self.display_name)


class Family(Base):
    __tablename__ = "family"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gedcom_id = Column(Text, nullable=False, unique=True)
    husband_id = Column(Integer, ForeignKey("person.id", ondelete="SET NULL"))
    wife_id = Column(Integer, ForeignKey("person.id", ondelete="SET NULL"))
    created_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())

    husband = relationship("Person", foreign_keys=[husband_id])
    wife = relationship("Person", foreign_keys=[wife_id])
    children = relationship("FamilyChild", back_populates="family", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="family")

    def __repr__(self):
        return "<Family {}>".format(self.gedcom_id)


class FamilyChild(Base):
    __tablename__ = "family_child"

    id = Column(Integer, primary_key=True, autoincrement=True)
    family_id = Column(Integer, ForeignKey("family.id", ondelete="CASCADE"), nullable=False)
    child_id = Column(Integer, ForeignKey("person.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(Text, nullable=False, default="biological")

    family = relationship("Family", back_populates="children")
    child = relationship("Person")

    __table_args__ = (UniqueConstraint("family_id", "child_id"),)


class Event(Base):
    __tablename__ = "event"

    id = Column(Integer, primary_key=True, autoincrement=True)
    person_id = Column(Integer, ForeignKey("person.id", ondelete="CASCADE"), nullable=False)
    family_id = Column(Integer, ForeignKey("family.id", ondelete="SET NULL"))
    event_type_id = Column(Integer, ForeignKey("event_type.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("location.id", ondelete="SET NULL"))

    date_raw = Column(Text)
    date_sort = Column(Text)
    date_end = Column(Text)
    date_precision = Column(Text, nullable=False, default="unknown")

    validation_status = Column(Text, nullable=False, default="unvalidated")
    confidence = Column(Float)
    description = Column(Text)
    created_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())

    person = relationship("Person", back_populates="events")
    family = relationship("Family", back_populates="events")
    event_type = relationship("EventType", back_populates="events")
    location = relationship("Location", back_populates="events")

    def __repr__(self):
        return "<Event {} {} {}>".format(self.person_id, self.event_type_id, self.date_raw)


class Conflict(Base):
    __tablename__ = "conflict"

    id = Column(Integer, primary_key=True, autoincrement=True)
    person_id = Column(Integer, ForeignKey("person.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(Integer, ForeignKey("event.id", ondelete="SET NULL"))
    related_event_id = Column(Integer, ForeignKey("event.id", ondelete="SET NULL"))

    conflict_type = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Text, nullable=False, default="warning")

    resolution = Column(Text)
    resolved_at = Column(Text)
    resolved_by = Column(Text)
    notes = Column(Text)
    created_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())

    person = relationship("Person", back_populates="conflicts")
    event = relationship("Event", foreign_keys=[event_id])
    related_event = relationship("Event", foreign_keys=[related_event_id])

    def __repr__(self):
        return "<Conflict {} {} {}>".format(self.person_id, self.conflict_type, self.severity)


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

_EVENT_TYPES = [
    ("BIRT", "Birth", "#22c55e", 1),
    ("DEAT", "Death", "#ef4444", 2),
    ("MARR", "Marriage", "#3b82f6", 3),
    ("DIV", "Divorce", "#8b5cf6", 4),
    ("IMMI", "Immigration", "#f97316", 5),
    ("EMIG", "Emigration", "#f97316", 6),
    ("BURI", "Burial", "#6b7280", 7),
    ("CENS", "Census", "#06b6d4", 8),
    ("RESI", "Residence", "#eab308", 9),
    ("NATU", "Naturalization", "#f97316", 10),
    ("OCCU", "Occupation", "#a855f7", 11),
    ("BAPM", "Baptism", "#14b8a6", 12),
    ("CHR", "Christening", "#14b8a6", 13),
    ("PROB", "Probate", "#6b7280", 14),
    ("WILL", "Will", "#6b7280", 15),
    ("GRAD", "Graduation", "#a855f7", 16),
    ("RETI", "Retirement", "#a855f7", 17),
    ("EVEN", "Other Event", "#9ca3af", 99),
]


def _seed_event_types(session):
    if session.query(EventType).count() > 0:
        return
    for code, label, color, order in _EVENT_TYPES:
        session.add(EventType(code=code, label=label, color=color, sort_order=order))
    session.commit()
