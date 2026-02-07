import { useState } from "react";
import type { LocationOut } from "../api/types";

interface Props {
  locations: LocationOut[];
  onConfirm: (targetId: number) => void;
  onCancel: () => void;
}

export default function LocationMergeModal({ locations, onConfirm, onCancel }: Props) {
  const [targetId, setTargetId] = useState<number>(locations[0]?.id ?? 0);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-xl border p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-xl font-normal mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          Merge Locations
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Select the location to keep. All events from other selected locations will be moved to it.
        </p>

        <div className="space-y-2 mb-6">
          {locations.map((loc) => (
            <label
              key={loc.id}
              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
              style={{
                background: targetId === loc.id ? "rgba(200, 163, 78, 0.1)" : "var(--bg-surface)",
                border: `1px solid ${targetId === loc.id ? "var(--gold-dim)" : "var(--border)"}`,
              }}
            >
              <input
                type="radio"
                name="target"
                checked={targetId === loc.id}
                onChange={() => setTargetId(loc.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {loc.normalized || loc.raw_text}
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {loc.city && <span>{loc.city}</span>}
                  {loc.state && <span>{loc.state}</span>}
                  {loc.country && <span>{loc.country}</span>}
                  <span>{loc.event_count} events</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      background: loc.geocode_status === "success" ? "rgba(78,158,110,0.15)" : "rgba(200,163,78,0.15)",
                      color: loc.geocode_status === "success" ? "#4e9e6e" : "var(--gold)",
                    }}
                  >
                    {loc.geocode_status}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(targetId)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--gold)", color: "var(--bg-deep)" }}
          >
            Merge {locations.length - 1} into selected
          </button>
        </div>
      </div>
    </div>
  );
}
