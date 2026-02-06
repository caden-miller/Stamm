/**
 * PulseLayer — renders animated expanding rings on the Leaflet map
 * when a new event is revealed during timelapse playback.
 *
 * Uses Leaflet DivIcon markers (not CircleMarkers) so we can
 * control the animation entirely with CSS.
 */
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export interface PulseEvent {
  id: number;
  lat: number;
  lng: number;
  color: string;
}

interface Props {
  pulses: PulseEvent[];
}

const PULSE_DURATION_MS = 1800;

export default function PulseLayer({ pulses }: Props) {
  const map = useMap();
  const activeRef = useRef<Map<number, L.Marker>>(new Map());

  useEffect(() => {
    for (const pulse of pulses) {
      // Don't re-create if already pulsing
      if (activeRef.current.has(pulse.id)) continue;

      const icon = L.divIcon({
        className: "pulse-container",
        html:
          `<div class="pulse-dot" style="background:${pulse.color};--pulse-color:${pulse.color}40"></div>` +
          `<div class="pulse-ring" style="border-color:${pulse.color}"></div>` +
          `<div class="pulse-ring pulse-ring-2" style="border-color:${pulse.color}"></div>` +
          `<div class="pulse-ring pulse-ring-3" style="border-color:${pulse.color}"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([pulse.lat, pulse.lng], {
        icon,
        interactive: false,
        pane: "overlayPane",
      });
      marker.addTo(map);
      activeRef.current.set(pulse.id, marker);

      // Auto-remove after animation completes
      setTimeout(() => {
        marker.remove();
        activeRef.current.delete(pulse.id);
      }, PULSE_DURATION_MS);
    }
  }, [pulses, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current.forEach((m) => m.remove());
      activeRef.current.clear();
    };
  }, []);

  return null;
}
