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

export interface CountryCount {
  country: string;
  count: number;
}

export interface StateCount {
  state: string;
  country: string;
  count: number;
}

export interface OriginsData {
  birth_countries: CountryCount[];
  birth_states: StateCount[];
  death_countries: CountryCount[];
  death_states: StateCount[];
}

export interface CityCount {
  city: string;
  state: string;
  country: string;
  event_count: number;
}

export interface TopLocationsData {
  top_cities: CityCount[];
}

export interface HistogramBucket {
  period: string;
  count: number;
}

export interface TimelineHistogram {
  bucket_size: string;
  histogram: HistogramBucket[];
}

export interface EventTypeCount {
  code: string;
  label: string;
  color: string;
  count: number;
}

export interface EventsByType {
  event_types: EventTypeCount[];
}

export interface FamilySizeDistribution {
  distribution: { children: number; families: number }[];
  total_families: number;
  avg_children: number;
}

export interface GenderDistribution {
  distribution: { sex: string; count: number }[];
  total_persons: number;
}

export interface LifespanData {
  average_lifespan: number | null;
  median_lifespan: number | null;
  min_lifespan: number | null;
  max_lifespan: number | null;
  person_count: number;
}

export interface PersonNode {
  id: number;
  gedcom_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  sex: string | null;
}

export interface AncestorNode extends PersonNode {
  generation: number;
  parents: PersonNode[];
}

export interface AncestorsData {
  root_person_id: number;
  root_person_name: string;
  generations: number;
  ancestors: AncestorNode[];
}

export interface DescendantNode extends PersonNode {
  generation: number;
  children: PersonNode[];
}

export interface DescendantsData {
  root_person_id: number;
  root_person_name: string;
  generations: number;
  descendants: DescendantNode[];
}

export interface PathNode extends PersonNode {
  relationship_to_next: string | null;
}

export interface RelationshipPath {
  person1_id: number;
  person1_name: string;
  person2_id: number;
  person2_name: string;
  path_found: boolean;
  path_length?: number;
  path: PathNode[];
  relationship_description: string;
}

export interface ConflictResolveRequest {
  resolution: string;
  notes?: string;
}
