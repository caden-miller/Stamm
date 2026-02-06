/* Typed fetch wrappers for the Ancestry Viewer API. */

import type {
  PersonSummary,
  PersonDetail,
  EventTypeOut,
  TimelineResponse,
  GeoFeatureCollection,
  ConflictOut,
  StatsOut,
} from "./types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ---- Persons ---- */

export function fetchPersons(search?: string): Promise<PersonSummary[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const qs = params.toString();
  return get(`/persons${qs ? `?${qs}` : ""}`);
}

export function fetchPerson(id: number): Promise<PersonDetail> {
  return get(`/persons/${id}`);
}

/* ---- Event types ---- */

export function fetchEventTypes(): Promise<EventTypeOut[]> {
  return get("/events/types");
}

/* ---- Timeline ---- */

export function fetchTimeline(filters?: {
  dateFrom?: string;
  dateTo?: string;
  eventTypes?: string[];
  personIds?: number[];
}): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters?.dateTo) params.set("date_to", filters.dateTo);
  if (filters?.eventTypes?.length)
    params.set("event_types", filters.eventTypes.join(","));
  if (filters?.personIds?.length)
    params.set("person_ids", filters.personIds.join(","));
  const qs = params.toString();
  return get(`/timeline${qs ? `?${qs}` : ""}`);
}

/* ---- GeoJSON ---- */

export function fetchGeoJSON(filters?: {
  dateFrom?: string;
  dateTo?: string;
  eventTypes?: string[];
  personIds?: number[];
}): Promise<GeoFeatureCollection> {
  const params = new URLSearchParams();
  if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters?.dateTo) params.set("date_to", filters.dateTo);
  if (filters?.eventTypes?.length)
    params.set("event_types", filters.eventTypes.join(","));
  if (filters?.personIds?.length)
    params.set("person_ids", filters.personIds.join(","));
  const qs = params.toString();
  return get(`/locations/geojson${qs ? `?${qs}` : ""}`);
}

/* ---- Conflicts ---- */

export function fetchConflicts(): Promise<ConflictOut[]> {
  return get("/conflicts?unresolved_only=false");
}

/* ---- Stats ---- */

export function fetchStats(): Promise<StatsOut> {
  return get("/stats");
}
