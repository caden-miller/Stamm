import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoFeatureCollection, GeoFeature } from "../api/types";
import PulseLayer from "./PulseLayer";
import ClusteredMarkers from "./ClusteredMarkers";
import type { PulseEvent } from "./PulseLayer";

interface Props {
  geojson: GeoFeatureCollection | null;
  selectedEventId: number | null;
  onSelectEvent: (eventId: number | null, personId?: number) => void;
  /** When non-null, only show events whose id is in this set. */
  visibleEventIds: Set<number> | null;
  /** Events that should pulse right now. */
  pulsingEvents: PulseEvent[];
  /** Whether timelapse is active (dims the base map for contrast). */
  timelapseActive: boolean;
}

/* Fits map bounds to visible markers on first load. */
function FitBounds({ features }: { features: GeoFeature[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (features.length === 0) return;
    if (fitted.current) return;
    const coords = features.map(
      (f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number]
    );
    map.fitBounds(coords, { padding: [40, 40], maxZoom: 6 });
    fitted.current = true;
  }, [features, map]);

  return null;
}

export default function MapView({
  geojson,
  selectedEventId,
  onSelectEvent,
  visibleEventIds,
  pulsingEvents,
  timelapseActive,
}: Props) {
  const allFeatures = useMemo(() => geojson?.features ?? [], [geojson]);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);

  const visibleFeatures = useMemo(() => {
    if (!visibleEventIds) return allFeatures;
    return allFeatures.filter((f) => visibleEventIds.has(f.properties.event_id));
  }, [allFeatures, visibleEventIds]);

  // Disable clustering during timelapse
  const showClustered = clusteringEnabled && !timelapseActive;

  return (
    <MapContainer
      center={[39.8, -98.5]}
      zoom={4}
      className={`h-full w-full ${timelapseActive ? "timelapse-active" : ""}`}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds features={allFeatures} />
      <PulseLayer pulses={pulsingEvents} />

      {showClustered ? (
        <ClusteredMarkers
          features={visibleFeatures}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
        />
      ) : (
        visibleFeatures.map((feature) => {
          const { coordinates } = feature.geometry;
          const p = feature.properties;
          const isSelected = selectedEventId === p.event_id;
          return (
            <CircleMarker
              key={`${p.event_id}-${p.person_id}`}
              center={[coordinates[1], coordinates[0]]}
              radius={isSelected ? 10 : 7}
              pathOptions={{
                color: isSelected ? "#fff" : p.color,
                fillColor: p.color,
                fillOpacity: isSelected ? 1 : 0.75,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => onSelectEvent(p.event_id, p.person_id),
              }}
            >
              <Popup>
                <div className="text-sm leading-tight">
                  <div className="font-semibold">{p.person_name}</div>
                  <div style={{ color: p.color }} className="font-medium">
                    {p.event_label}
                  </div>
                  <div className="text-zinc-500">
                    {p.date_raw ?? p.date_sort ?? "No date"}
                  </div>
                  <div className="text-zinc-400 text-xs">{p.location_name}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })
      )}

      {/* Clustering toggle */}
      <ClusterToggle enabled={clusteringEnabled} onToggle={() => setClusteringEnabled((v) => !v)} />
    </MapContainer>
  );
}

function ClusterToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div
      className="leaflet-top leaflet-left"
      style={{ position: "absolute", top: 80, left: 10, zIndex: 1000 }}
    >
      <button
        onClick={onToggle}
        className="leaflet-control px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: enabled ? "var(--gold)" : "var(--bg-card)",
          color: enabled ? "var(--bg-deep)" : "var(--text-secondary)",
          border: `1px solid ${enabled ? "var(--gold)" : "var(--border)"}`,
          cursor: "pointer",
        }}
        title={enabled ? "Disable clustering" : "Enable clustering"}
      >
        {enabled ? "Clusters: On" : "Clusters: Off"}
      </button>
    </div>
  );
}
