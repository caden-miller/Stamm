import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import type { GeoFeature } from "../api/types";

interface Props {
  features: GeoFeature[];
  selectedEventId: number | null;
  onSelectEvent: (eventId: number, personId?: number) => void;
}

export default function ClusteredMarkers({ features, selectedEventId, onSelectEvent }: Props) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!clusterRef.current) {
      clusterRef.current = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          let size = "small";
          if (count > 50) size = "large";
          else if (count > 10) size = "medium";
          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(40, 40),
          });
        },
      });
      map.addLayer(clusterRef.current);
    }

    const group = clusterRef.current;
    group.clearLayers();

    for (const feature of features) {
      const { coordinates } = feature.geometry;
      const p = feature.properties;
      const isSelected = selectedEventId === p.event_id;

      const marker = L.circleMarker([coordinates[1], coordinates[0]], {
        radius: isSelected ? 10 : 7,
        color: isSelected ? "#fff" : p.color,
        fillColor: p.color,
        fillOpacity: isSelected ? 1 : 0.75,
        weight: isSelected ? 3 : 1.5,
      });

      marker.bindPopup(`
        <div style="font-size:13px;line-height:1.4">
          <div style="font-weight:600">${p.person_name}</div>
          <div style="color:${p.color};font-weight:500">${p.event_label}</div>
          <div style="color:#999">${p.date_raw ?? p.date_sort ?? "No date"}</div>
          <div style="color:#777;font-size:11px">${p.location_name}</div>
        </div>
      `);

      marker.on("click", () => onSelectEvent(p.event_id, p.person_id));
      group.addLayer(marker);
    }

    return () => {
      // Don't remove the cluster group on re-render, just clear markers next time
    };
  }, [features, selectedEventId, onSelectEvent, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map]);

  return null;
}
