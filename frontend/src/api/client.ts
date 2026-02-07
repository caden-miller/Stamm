/* Typed fetch wrappers for the Ancestry Viewer API. */

import type {
  PersonSummary,
  PersonDetail,
  EventTypeOut,
  TimelineResponse,
  GeoFeatureCollection,
  ConflictOut,
  StatsOut,
  OriginsData,
  TopLocationsData,
  TimelineHistogram,
  EventsByType,
  FamilySizeDistribution,
  GenderDistribution,
  LifespanData,
  AncestorsData,
  DescendantsData,
  RelationshipPath,
  ConflictResolveRequest,
} from "./types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

/* ---- Analytics ---- */

export function fetchOrigins(): Promise<OriginsData> {
  return get("/analytics/origins");
}

export function fetchTopLocations(limit?: number): Promise<TopLocationsData> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit.toString());
  const qs = params.toString();
  return get(`/analytics/locations/top${qs ? `?${qs}` : ""}`);
}

export function fetchTimelineHistogram(
  bucketSize: "decade" | "century" = "decade"
): Promise<TimelineHistogram> {
  return get(`/analytics/timeline/histogram?bucket_size=${bucketSize}`);
}

export function fetchEventsByType(): Promise<EventsByType> {
  return get("/analytics/timeline/events-by-type");
}

export function fetchFamilySizeDistribution(): Promise<FamilySizeDistribution> {
  return get("/analytics/families/size-distribution");
}

export function fetchGenderDistribution(): Promise<GenderDistribution> {
  return get("/analytics/demographics/gender");
}

export function fetchLifespan(): Promise<LifespanData> {
  return get("/analytics/lifespan/average");
}

/* ---- Ancestry ---- */

export function fetchAncestors(
  personId: number,
  generations: number = 3
): Promise<AncestorsData> {
  return get(`/ancestry/persons/${personId}/ancestors?generations=${generations}`);
}

export function fetchDescendants(
  personId: number,
  generations: number = 3
): Promise<DescendantsData> {
  return get(`/ancestry/persons/${personId}/descendants?generations=${generations}`);
}

export function fetchRelationshipPath(
  person1Id: number,
  person2Id: number
): Promise<RelationshipPath> {
  return get(`/ancestry/persons/${person1Id}/path/${person2Id}`);
}

/* ---- Conflict Resolution ---- */

export function resolveConflict(
  conflictId: number,
  request: ConflictResolveRequest
): Promise<ConflictOut> {
  return patch(`/conflicts/${conflictId}`, request);
}
