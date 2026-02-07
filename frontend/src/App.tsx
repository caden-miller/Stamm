import { useEffect, useState, useCallback, useRef } from "react";
import type {
  EventTypeOut,
  PersonSummary,
  PersonDetail as PersonDetailT,
  TimelineResponse,
  GeoFeatureCollection,
  ConflictOut,
  StatsOut,
  GeoFeature,
} from "./api/types";
import {
  fetchEventTypes,
  fetchPersons,
  fetchPerson,
  fetchTimeline,
  fetchGeoJSON,
  fetchConflicts,
  fetchStats,
} from "./api/client";

import FilterBar from "./components/FilterBar";
import PersonList from "./components/PersonList";
import PersonDetail from "./components/PersonDetail";
import ConflictPanel from "./components/ConflictPanel";
import Dashboard from "./components/Dashboard";
import Timeline from "./components/Timeline";
import MapView from "./components/MapView";
import TimelapseControls from "./components/TimelapseControls";
import type { PulseEvent } from "./components/PulseLayer";

type SidebarTab = "persons" | "detail" | "conflicts" | "dashboard";

/** Sort geo features by date for timelapse. */
function sortedDatedFeatures(geo: GeoFeatureCollection | null): GeoFeature[] {
  if (!geo) return [];
  return geo.features
    .filter((f) => f.properties.date_sort)
    .sort((a, b) => (a.properties.date_sort! < b.properties.date_sort! ? -1 : 1));
}

export default function App() {
  /* ---- Core data ---- */
  const [eventTypes, setEventTypes] = useState<EventTypeOut[]>([]);
  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [stats, setStats] = useState<StatsOut | null>(null);
  const [conflicts, setConflicts] = useState<ConflictOut[]>([]);

  /* ---- Filter state ---- */
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  /* ---- View data ---- */
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [geoData, setGeoData] = useState<GeoFeatureCollection | null>(null);

  /* ---- Selection state ---- */
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [personDetail, setPersonDetail] = useState<PersonDetailT | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("persons");

  /* ---- Timelapse state ---- */
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(800);
  const [visibleEventIds, setVisibleEventIds] = useState<Set<number> | null>(null);
  const [pulsingEvents, setPulsingEvents] = useState<PulseEvent[]>([]);
  const [playbackDate, setPlaybackDate] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sortedRef = useRef<GeoFeature[]>([]);
  const rangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ================================================================
     Initial load
     ================================================================ */
  useEffect(() => {
    fetchEventTypes().then((types) => {
      setEventTypes(types);
      setActiveTypes(types.map((t) => t.code));
    });
    fetchPersons().then(setPersons);
    fetchStats().then(setStats);
    fetchConflicts().then(setConflicts);

    // Cleanup debounce timer on unmount
    return () => {
      if (rangeDebounceRef.current) {
        clearTimeout(rangeDebounceRef.current);
      }
    };
  }, []);

  /* ================================================================
     Refetch on filter change
     ================================================================ */
  useEffect(() => {
    if (activeTypes.length === 0) {
      setTimelineData({ items: [], groups: [] });
      setGeoData({ type: "FeatureCollection", features: [] });
      return;
    }
    const filters = {
      eventTypes: activeTypes,
      personIds: searchQuery ? persons.map((p) => p.id) : undefined,
      dateFrom: dateRange?.start,
      dateTo: dateRange?.end,
    };
    fetchTimeline(filters).then(setTimelineData);
    fetchGeoJSON(filters).then((geo) => {
      setGeoData(geo);
      sortedRef.current = sortedDatedFeatures(geo);
    });
  }, [activeTypes, persons, searchQuery, dateRange]);

  /* ================================================================
     Filter handlers
     ================================================================ */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    fetchPersons(query || undefined).then(setPersons);
  }, []);

  const handleToggleType = useCallback((code: string) => {
    setActiveTypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  /* ================================================================
     Person / event selection
     ================================================================ */
  const handleSelectPerson = useCallback((id: number) => {
    setSelectedPersonId(id);
    setSelectedEventId(null);
    setSidebarTab("detail");
    setDetailLoading(true);
    fetchPerson(id)
      .then(setPersonDetail)
      .finally(() => setDetailLoading(false));
  }, []);

  const handleClosePerson = useCallback(() => {
    setSelectedPersonId(null);
    setPersonDetail(null);
    setSidebarTab("persons");
  }, []);

  const handleSelectEvent = useCallback(
    (eventId: number | null, personId?: number) => {
      setSelectedEventId(eventId);
      if (personId && personId !== selectedPersonId) {
        handleSelectPerson(personId);
      }
    },
    [selectedPersonId, handleSelectPerson]
  );

  const handleTimelineSelect = useCallback(
    (eventId: number | null) => {
      setSelectedEventId(eventId);
      if (eventId && timelineData) {
        const item = timelineData.items.find((i) => i.id === eventId);
        if (item && item.group !== selectedPersonId) {
          handleSelectPerson(item.group);
        }
      }
    },
    [timelineData, selectedPersonId, handleSelectPerson]
  );

  const handleRangeChanged = useCallback((start: string, end: string) => {
    // Debounce to avoid excessive API calls during pan/zoom
    if (rangeDebounceRef.current) {
      clearTimeout(rangeDebounceRef.current);
    }
    rangeDebounceRef.current = setTimeout(() => {
      setDateRange({ start, end });
    }, 500);
  }, []);

  /* ================================================================
     Timelapse engine
     ================================================================ */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setPlaybackIndex((prev) => {
      const next = prev + 1;
      const features = sortedRef.current;
      if (next >= features.length) {
        setIsPlaying(false);
        return prev;
      }

      const feature = features[next];
      const p = feature.properties;

      // Reveal this event
      setVisibleEventIds((s) => {
        const copy = new Set(s ?? []);
        copy.add(p.event_id);
        return copy;
      });

      // Pulse
      setPulsingEvents([
        {
          id: p.event_id,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          color: p.color,
        },
      ]);

      // Move timeline cursor
      setPlaybackDate(p.date_sort);

      return next;
    });
  }, []);

  useEffect(() => {
    if (isPlaying) {
      tick();
      timerRef.current = setInterval(tick, playbackSpeed);
    } else {
      stopTimer();
    }
    return stopTimer;
  }, [isPlaying, playbackSpeed, tick, stopTimer]);

  const handlePlay = useCallback(() => {
    if (sortedRef.current.length === 0) return;
    if (playbackIndex >= sortedRef.current.length - 1) {
      setPlaybackIndex(-1);
      setVisibleEventIds(new Set());
      setPulsingEvents([]);
      setPlaybackDate(null);
    }
    setIsPlaying(true);
  }, [playbackIndex]);

  const handlePause = useCallback(() => setIsPlaying(false), []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setPlaybackIndex(-1);
    setVisibleEventIds(null);
    setPulsingEvents([]);
    setPlaybackDate(null);
  }, []);

  const handleSeek = useCallback((pct: number) => {
    const features = sortedRef.current;
    if (features.length === 0) return;
    const idx = Math.min(Math.floor(pct * features.length), features.length - 1);
    const ids = new Set<number>();
    for (let i = 0; i <= idx; i++) ids.add(features[i].properties.event_id);
    setPlaybackIndex(idx);
    setVisibleEventIds(ids);
    setPlaybackDate(features[idx].properties.date_sort);
    setPulsingEvents([]);
  }, []);

  const handleSpeedChange = useCallback(
    (ms: number) => {
      setPlaybackSpeed(ms);
      if (isPlaying) {
        stopTimer();
        timerRef.current = setInterval(tick, ms);
      }
    },
    [isPlaying, stopTimer, tick]
  );

  /* ================================================================
     Conflict resolution
     ================================================================ */
  const handleConflictResolved = useCallback((updatedConflict: ConflictOut) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === updatedConflict.id ? updatedConflict : c))
    );
    // Refetch stats to update counts
    fetchStats().then(setStats);
  }, []);

  /* ---- Timelapse derived ---- */
  const timelapseActive = visibleEventIds !== null;
  const features = sortedRef.current;
  const progress =
    features.length > 0 && playbackIndex >= 0
      ? (playbackIndex + 1) / features.length
      : 0;
  const cur = playbackIndex >= 0 ? features[playbackIndex] : null;
  const currentLabel = cur
    ? `${cur.properties.date_sort?.slice(0, 4) ?? "?"} - ${cur.properties.person_name}, ${cur.properties.event_label}`
    : "";

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div className="h-screen flex flex-col bg-zinc-900">
      <FilterBar
        eventTypes={eventTypes}
        activeTypes={activeTypes}
        onToggleType={handleToggleType}
        onSearch={handleSearch}
        stats={stats}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 shrink-0 bg-zinc-900 border-r border-zinc-700 flex flex-col">
          <div className="flex border-b border-zinc-700">
            {(
              [
                ["persons", "Persons"],
                ["detail", "Detail"],
                ["conflicts", "Conflicts"],
                ["dashboard", "Dashboard"],
              ] as [SidebarTab, string][]
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 text-xs font-medium transition
                  ${sidebarTab === tab
                    ? "text-zinc-100 border-b-2 border-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {label}
                {tab === "conflicts" && conflicts.length > 0 && (
                  <span className="ml-1 text-amber-400">
                    ({conflicts.filter((c) => !c.resolution).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {sidebarTab === "persons" && (
              <PersonList
                persons={persons}
                selectedPersonId={selectedPersonId}
                onSelectPerson={handleSelectPerson}
              />
            )}
            {sidebarTab === "detail" && (
              <PersonDetail
                person={personDetail}
                loading={detailLoading}
                onClose={handleClosePerson}
                onSelectEvent={(id) => setSelectedEventId(id)}
              />
            )}
            {sidebarTab === "conflicts" && (
              <ConflictPanel
                conflicts={conflicts}
                onSelectPerson={handleSelectPerson}
                onConflictResolved={handleConflictResolved}
              />
            )}
            {sidebarTab === "dashboard" && <Dashboard stats={stats} />}
          </div>
        </div>

        {/* Center: Map + Controls + Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            <MapView
              geojson={geoData}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              visibleEventIds={visibleEventIds}
              pulsingEvents={pulsingEvents}
              timelapseActive={timelapseActive}
            />
          </div>

          <TimelapseControls
            isPlaying={isPlaying}
            progress={progress}
            currentLabel={currentLabel}
            speed={playbackSpeed}
            onPlay={handlePlay}
            onPause={handlePause}
            onReset={handleReset}
            onSpeedChange={handleSpeedChange}
            onSeek={handleSeek}
          />

          <div className="h-[35%] min-h-[180px] border-t border-zinc-700">
            <Timeline
              data={timelineData}
              selectedEventId={selectedEventId}
              onSelectEvent={handleTimelineSelect}
              onRangeChanged={handleRangeChanged}
              playbackDate={playbackDate}
              revealedIds={visibleEventIds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
