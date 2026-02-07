/* Typed fetch wrappers for the Stamm API. */

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
  PersonPhotoOut,
  PersonPhotoUpdate,
  LocationOut,
  GeocodeProgressEvent,
  GeocodeSummary,
  LocationMergeResponse,
  FamilyData,
} from "./types";

const BASE = "/api";

/* ---- localStorage cache ---- */

const CACHE_PREFIX = "av:";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    /* storage full — skip */
  }
}

export function clearApiCache(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/* ---- HTTP helpers ---- */

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function cachedGet<T>(path: string): Promise<T> {
  const hit = readCache<T>(path);
  if (hit !== null) return hit;
  const data = await get<T>(path);
  writeCache(path, data);
  return data;
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

export function fetchPersons(opts?: {
  search?: string;
  limit?: number;
}): Promise<PersonSummary[]> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  params.set("limit", String(opts?.limit ?? 500));
  const qs = params.toString();
  return cachedGet(`/persons?${qs}`);
}

export function fetchPerson(id: number): Promise<PersonDetail> {
  return cachedGet(`/persons/${id}`);
}

export function fetchNeedsReviewPersons(): Promise<PersonSummary[]> {
  return get("/persons?needs_review=true&limit=500");
}

export async function markPersonReviewed(
  personId: number,
  reviewed: boolean,
): Promise<PersonSummary> {
  return patch(`/persons/${personId}/review`, { reviewed });
}

/* ---- Event types ---- */

export function fetchEventTypes(): Promise<EventTypeOut[]> {
  return cachedGet("/events/types");
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
  return cachedGet("/conflicts?unresolved_only=false");
}

/* ---- Stats ---- */

export function fetchStats(): Promise<StatsOut> {
  return cachedGet("/stats");
}

/* ---- Analytics (all cached) ---- */

export function fetchOrigins(): Promise<OriginsData> {
  return cachedGet("/analytics/origins");
}

export function fetchTopLocations(limit?: number): Promise<TopLocationsData> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit.toString());
  const qs = params.toString();
  return cachedGet(`/analytics/locations/top${qs ? `?${qs}` : ""}`);
}

export function fetchTimelineHistogram(
  bucketSize: "decade" | "century" = "decade"
): Promise<TimelineHistogram> {
  return cachedGet(`/analytics/timeline/histogram?bucket_size=${bucketSize}`);
}

export function fetchEventsByType(): Promise<EventsByType> {
  return cachedGet("/analytics/timeline/events-by-type");
}

export function fetchFamilySizeDistribution(): Promise<FamilySizeDistribution> {
  return cachedGet("/analytics/families/size-distribution");
}

export function fetchGenderDistribution(): Promise<GenderDistribution> {
  return cachedGet("/analytics/demographics/gender");
}

export function fetchLifespan(): Promise<LifespanData> {
  return cachedGet("/analytics/lifespan/average");
}

/* ---- Ancestry ---- */

export function fetchAncestors(
  personId: number,
  generations: number = 3
): Promise<AncestorsData> {
  return cachedGet(`/ancestry/persons/${personId}/ancestors?generations=${generations}`);
}

export function fetchDescendants(
  personId: number,
  generations: number = 3
): Promise<DescendantsData> {
  return cachedGet(`/ancestry/persons/${personId}/descendants?generations=${generations}`);
}

export function fetchFamily(personId: number): Promise<FamilyData> {
  return get(`/ancestry/persons/${personId}/family`);
}

export function fetchRelationshipPath(
  person1Id: number,
  person2Id: number
): Promise<RelationshipPath> {
  return cachedGet(`/ancestry/persons/${person1Id}/path/${person2Id}`);
}

/* ---- Conflict Resolution ---- */

export function resolveConflict(
  conflictId: number,
  request: ConflictResolveRequest
): Promise<ConflictOut> {
  return patch(`/conflicts/${conflictId}`, request);
}

/* ---- Photos ---- */

export async function uploadPhoto(
  personId: number,
  file: File,
  caption?: string,
  dateTaken?: string,
  isPrimary: boolean = false
): Promise<PersonPhotoOut> {
  const formData = new FormData();
  formData.append("file", file);
  if (caption) formData.append("caption", caption);
  if (dateTaken) formData.append("date_taken", dateTaken);
  formData.append("is_primary", isPrimary.toString());

  const res = await fetch(`${BASE}/persons/${personId}/photos`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<PersonPhotoOut>;
}

export function fetchPhotos(personId: number): Promise<PersonPhotoOut[]> {
  return get(`/persons/${personId}/photos`);
}

export async function updatePhoto(
  photoId: number,
  update: PersonPhotoUpdate
): Promise<PersonPhotoOut> {
  return patch(`/photos/${photoId}`, update);
}

export async function deletePhoto(photoId: number): Promise<void> {
  const res = await fetch(`${BASE}/photos/${photoId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
}

/* ---- Locations ---- */

export function fetchLocations(opts?: {
  geocode_status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<LocationOut[]> {
  const params = new URLSearchParams();
  if (opts?.geocode_status) params.set("geocode_status", opts.geocode_status);
  if (opts?.search) params.set("search", opts.search);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return get(`/locations${qs ? `?${qs}` : ""}`);
}

export function startGeocode(
  limit: number,
  onProgress: (event: GeocodeProgressEvent) => void,
  onComplete: (summary: GeocodeSummary) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE}/locations/geocode/stream?limit=${limit}`, {
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "summary") {
            onComplete(data as GeocodeSummary);
          } else if (data.type === "progress") {
            onProgress(data as GeocodeProgressEvent);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }).catch(() => {
    // aborted or network error
  });

  return controller;
}

export async function mergeLocations(
  sourceIds: number[],
  targetId: number,
): Promise<LocationMergeResponse> {
  const res = await fetch(`${BASE}/locations/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_ids: sourceIds, target_id: targetId }),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<LocationMergeResponse>;
}
