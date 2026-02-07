import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../store";
import { fetchLocations, startGeocode, mergeLocations } from "../api/client";
import type { LocationOut, GeocodeProgressEvent, GeocodeSummary } from "../api/types";
import LocationMergeModal from "../components/LocationMergeModal";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: "rgba(78, 158, 110, 0.15)", text: "#4e9e6e" },
  pending: { bg: "rgba(200, 163, 78, 0.15)", text: "var(--gold)" },
  failed: { bg: "rgba(197, 80, 80, 0.15)", text: "#e07070" },
  skipped: { bg: "rgba(80, 136, 197, 0.15)", text: "#5088c5" },
};

export default function LocationsPage() {
  const stats = useAppStore((s) => s.stats);
  const refreshStats = useAppStore((s) => s.refreshStats);

  const [locations, setLocations] = useState<LocationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  // Geocoding state
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
  const [geocodeSummary, setGeocodeSummary] = useState<GeocodeSummary | null>(null);

  // Selection + merge
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showMerge, setShowMerge] = useState(false);

  const loadLocations = useCallback(() => {
    setLoading(true);
    fetchLocations({
      geocode_status: filter || undefined,
      search: search || undefined,
      limit: 500,
    })
      .then(setLocations)
      .finally(() => setLoading(false));
  }, [filter, search]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleGeocode = () => {
    setIsGeocoding(true);
    setGeocodeSummary(null);
    setGeocodeProgress({ current: 0, total: 0 });

    startGeocode(
      100,
      (evt: GeocodeProgressEvent) => {
        setGeocodeProgress({ current: evt.current, total: evt.total });
      },
      (summary: GeocodeSummary) => {
        setGeocodeSummary(summary);
        setIsGeocoding(false);
        loadLocations();
        refreshStats();
      },
    );
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === locations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(locations.map((l) => l.id)));
    }
  };

  const handleMerge = async (targetId: number) => {
    const sourceIds = [...selected].filter((id) => id !== targetId);
    try {
      await mergeLocations(sourceIds, targetId);
      setShowMerge(false);
      setSelected(new Set());
      loadLocations();
      refreshStats();
    } catch {
      alert("Failed to merge locations.");
    }
  };

  const selectedLocations = locations.filter((l) => selected.has(l.id));

  return (
    <div className="h-full overflow-y-auto page-enter">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl font-normal mb-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Locations
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Manage geocoding and location records
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selected.size >= 2 && (
              <button
                onClick={() => setShowMerge(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#5088c5", color: "#fff" }}
              >
                Merge {selected.size} selected
              </button>
            )}
            <button
              onClick={handleGeocode}
              disabled={isGeocoding}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              style={{ background: "var(--gold)", color: "var(--bg-deep)" }}
            >
              {isGeocoding ? "Geocoding..." : "Geocode Pending"}
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total", value: stats?.locations ?? 0 },
            { label: "Geocoded", value: stats?.locations_geocoded ?? 0, color: "#4e9e6e" },
            { label: "Pending", value: stats?.locations_pending ?? 0, color: "var(--gold)" },
            { label: "Failed", value: (stats?.locations ?? 0) - (stats?.locations_geocoded ?? 0) - (stats?.locations_pending ?? 0), color: "#e07070" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border p-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </div>
              <div className="text-2xl font-light" style={{ color: s.color ?? "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Geocoding progress */}
        {isGeocoding && (
          <div
            className="rounded-xl border p-4 mb-6"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Geocoding in progress...
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {geocodeProgress.current} / {geocodeProgress.total}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: geocodeProgress.total > 0 ? `${(geocodeProgress.current / geocodeProgress.total) * 100}%` : "0%",
                  background: "var(--gold)",
                }}
              />
            </div>
          </div>
        )}

        {/* Summary after geocoding */}
        {geocodeSummary && !isGeocoding && (
          <div
            className="rounded-xl border p-4 mb-6 flex items-center justify-between"
            style={{ background: "rgba(78,158,110,0.06)", borderColor: "rgba(78,158,110,0.2)" }}
          >
            <span className="text-sm" style={{ color: "#4e9e6e" }}>
              Geocoding complete: {geocodeSummary.success} success, {geocodeSummary.failed} failed, {geocodeSummary.skipped} skipped
            </span>
            <button
              onClick={() => setGeocodeSummary(null)}
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            {["", "success", "pending", "failed", "skipped"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-sm font-medium capitalize transition-colors"
                style={{
                  background: filter === f ? "var(--bg-card-hover)" : "var(--bg-card)",
                  color: filter === f ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {f || "All"}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm rounded-lg border px-3 py-2 outline-none w-64"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Location table */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === locations.length && locations.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                  City / State
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Events
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                  Coordinates
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Loading...
                  </td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No locations found
                  </td>
                </tr>
              ) : (
                locations.map((loc) => {
                  const colors = STATUS_COLORS[loc.geocode_status] ?? STATUS_COLORS.pending;
                  return (
                    <tr
                      key={loc.id}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(loc.id)}
                          onChange={() => toggleSelect(loc.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {loc.normalized || loc.raw_text}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {[loc.city, loc.state, loc.country].filter(Boolean).join(", ") || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          {loc.geocode_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                        {loc.event_count}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                        {loc.latitude && loc.longitude
                          ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Merge modal */}
        {showMerge && selectedLocations.length >= 2 && (
          <LocationMergeModal
            locations={selectedLocations}
            onConfirm={handleMerge}
            onCancel={() => setShowMerge(false)}
          />
        )}
      </div>
    </div>
  );
}
