/* TypeScript interfaces matching the FastAPI Pydantic schemas. */

export interface EventTypeOut {
  id: number;
  code: string;
  label: string;
  color: string;
}

export interface LocationBrief {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string;
}

export interface PersonSummary {
  id: number;
  gedcom_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  sex: string | null;
  needs_review: boolean;
  event_count: number;
  conflict_count: number;
}

export interface EventBrief {
  id: number;
  event_type: EventTypeOut;
  date_raw: string | null;
  date_sort: string | null;
  date_precision: string;
  location: LocationBrief | null;
  validation_status: string;
}

export interface FamilyBrief {
  id: number;
  gedcom_id: string;
  role: string;
  spouse_name: string | null;
  children: string[];
}

export interface PersonDetail extends PersonSummary {
  maiden_name: string | null;
  notes: string | null;
  events: EventBrief[];
  families: FamilyBrief[];
}

export interface EventOut {
  id: number;
  person_id: number;
  person_name: string;
  family_id: number | null;
  event_type: EventTypeOut;
  date_raw: string | null;
  date_sort: string | null;
  date_end: string | null;
  date_precision: string;
  location: LocationBrief | null;
  validation_status: string;
  confidence: number | null;
  description: string | null;
}

export interface TimelineItem {
  id: number;
  content: string;
  start: string;
  end: string | null;
  group: number;
  className: string;
  style: string;
  title: string;
  event_type: string;
}

export interface TimelineGroup {
  id: number;
  content: string;
  order: number | null;
}

export interface TimelineResponse {
  items: TimelineItem[];
  groups: TimelineGroup[];
}

export interface GeoProperties {
  event_id: number;
  person_id: number;
  person_name: string;
  event_type: string;
  event_label: string;
  color: string;
  date_sort: string | null;
  date_raw: string | null;
  date_precision: string;
  location_name: string;
}

export interface GeoFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: GeoProperties;
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

export interface ConflictOut {
  id: number;
  person_id: number;
  person_name: string;
  event_id: number | null;
  related_event_id: number | null;
  conflict_type: string;
  description: string;
  severity: string;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
}

export interface StatsOut {
  persons: number;
  families: number;
  events: number;
  locations: number;
  locations_geocoded: number;
  locations_pending: number;
  conflicts_total: number;
  conflicts_unresolved: number;
  persons_needing_review: number;
}
