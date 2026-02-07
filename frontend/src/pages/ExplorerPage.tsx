import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAppStore } from "../store";
import { fetchTimeline, fetchGeoJSON } from "../api/client";
import type {
  TimelineResponse,
  GeoFeatureCollection,
  GeoFeature,
} from "../api/types";
import MapView from "../components/MapView";
import Timeline from "../components/Timeline";
import TimelapseControls from "../components/TimelapseControls";
import PlaybackDateDisplay from "../components/PlaybackDateDisplay";
import EventChatPanel from "../components/EventChatPanel";
import type { ChatEntry } from "../components/EventChatPanel";
import type { PulseEvent } from "../components/PulseLayer";

function sortedDatedFeatures(geo: GeoFeatureCollection | null): GeoFeature[] {
  if (!geo) return [];
  return geo.features
    .filter((f) => f.properties.date_sort)
    .sort((a, b) => (a.properties.date_sort! < b.properties.date_sort! ? -1 : 1));
}

/** Build a ChatEntry from a GeoFeature. */
function featureToChatEntry(f: GeoFeature): ChatEntry {
  const p = f.properties;
  return {
    eventId: p.event_id,
    personId: p.person_id,
    personName: p.person_name,
    eventType: p.event_type,
    eventLabel: p.event_label,
    color: p.color,
    dateSorted: p.date_sort ?? "",
    dateRaw: p.date_raw,
    locationName: p.location_name,
  };
}

export default function ExplorerPage() {
  const eventTypes = useAppStore((s) => s.eventTypes);

  /* ---- Filter state ---- */
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  /* ---- View data ---- */
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [geoData, setGeoData] = useState<GeoFeatureCollection | null>(null);

  /* ---- Selection ---- */
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  /* ---- Timelapse ---- */
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(800);
  const [visibleEventIds, setVisibleEventIds] = useState<Set<number> | null>(null);
  const [pulsingEvents, setPulsingEvents] = useState<PulseEvent[]>([]);
  const [playbackDate, setPlaybackDate] = useState<string | null>(null);

  /* ---- Alive tracking + chat ---- */
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const birthMapRef = useRef(new Map<number, string>());
  const deathMapRef = useRef(new Map<number, string>());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sortedRef = useRef<GeoFeature[]>([]);
  const rangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<HTMLDivElement>(null);

  /* ---- Export state ---- */
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  /* ---- Init active types ---- */
  useEffect(() => {
    if (eventTypes.length > 0 && activeTypes.length === 0) {
      setActiveTypes(eventTypes.map((t) => t.code));
    }
  }, [eventTypes, activeTypes.length]);

  /* ---- Fetch on filter change ---- */
  useEffect(() => {
    if (activeTypes.length === 0) {
      setTimelineData({ items: [], groups: [] });
      setGeoData({ type: "FeatureCollection", features: [] });
      return;
    }
    const filters = {
      eventTypes: activeTypes,
      dateFrom: dateRange?.start,
      dateTo: dateRange?.end,
    };
    fetchTimeline(filters).then(setTimelineData);
    fetchGeoJSON(filters).then((geo) => {
      setGeoData(geo);
      sortedRef.current = sortedDatedFeatures(geo);
    });
  }, [activeTypes, dateRange]);

  /* ---- Cleanup ---- */
  useEffect(() => {
    return () => {
      if (rangeDebounceRef.current) clearTimeout(rangeDebounceRef.current);
    };
  }, []);

  /* ---- Filter handlers ---- */
  const handleToggleType = useCallback((code: string) => {
    setActiveTypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const handleSelectEvent = useCallback(
    (eventId: number | null, _personId?: number) => {
      setSelectedEventId(eventId);
    },
    []
  );

  const handleTimelineSelect = useCallback(
    (eventId: number | null) => {
      setSelectedEventId(eventId);
    },
    []
  );

  const handleRangeChanged = useCallback((start: string, end: string) => {
    if (rangeDebounceRef.current) clearTimeout(rangeDebounceRef.current);
    rangeDebounceRef.current = setTimeout(() => {
      setDateRange({ start, end });
    }, 500);
  }, []);

  /* ---- Helper: process a feature for alive tracking ---- */
  const processFeatureForTracking = useCallback((feature: GeoFeature) => {
    const p = feature.properties;
    if (p.event_type === "BIRT" && p.date_sort) {
      birthMapRef.current.set(p.person_id, p.date_sort);
    }
    if (p.event_type === "DEAT" && p.date_sort) {
      deathMapRef.current.set(p.person_id, p.date_sort);
    }
  }, []);

  /* ---- Timelapse engine ---- */
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
      setVisibleEventIds((s) => {
        const copy = new Set(s ?? []);
        copy.add(p.event_id);
        return copy;
      });
      setPulsingEvents([
        { id: p.event_id, lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0], color: p.color },
      ]);
      setPlaybackDate(p.date_sort);

      // Track alive state
      processFeatureForTracking(feature);

      // Add to chat
      setChatEntries((prev) => [...prev, featureToChatEntry(feature)]);

      return next;
    });
  }, [processFeatureForTracking]);

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
      // Reset for replay
      setPlaybackIndex(-1);
      setVisibleEventIds(new Set());
      setPulsingEvents([]);
      setPlaybackDate(null);
      setChatEntries([]);
      birthMapRef.current.clear();
      deathMapRef.current.clear();
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
    setChatEntries([]);
    birthMapRef.current.clear();
    deathMapRef.current.clear();
  }, []);

  const handleSeek = useCallback((pct: number) => {
    const features = sortedRef.current;
    if (features.length === 0) return;
    const idx = Math.min(Math.floor(pct * features.length), features.length - 1);

    // Rebuild visible IDs, chat entries, and alive maps
    const ids = new Set<number>();
    const entries: ChatEntry[] = [];
    birthMapRef.current.clear();
    deathMapRef.current.clear();

    for (let i = 0; i <= idx; i++) {
      const f = features[i];
      ids.add(f.properties.event_id);
      entries.push(featureToChatEntry(f));
      processFeatureForTracking(f);
    }

    setPlaybackIndex(idx);
    setVisibleEventIds(ids);
    setPlaybackDate(features[idx].properties.date_sort);
    setPulsingEvents([]);
    setChatEntries(entries);
  }, [processFeatureForTracking]);

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

  /* ---- Video export ---- */
  const handleExport = useCallback(async () => {
    const el = recordingRef.current;
    if (!el || sortedRef.current.length === 0) return;

    setIsExporting(true);
    setIsPlaying(false);
    stopTimer();

    // Reset timelapse
    setPlaybackIndex(-1);
    setVisibleEventIds(new Set());
    setPulsingEvents([]);
    setPlaybackDate(null);
    setChatEntries([]);
    birthMapRef.current.clear();
    deathMapRef.current.clear();

    // Dynamic import to avoid loading html2canvas until needed
    const html2canvas = (await import("html2canvas")).default;

    const features = sortedRef.current;
    const fps = 5;
    const frameDelay = 1000 / fps;

    // Setup canvas + recorder
    const canvas = document.createElement("canvas");
    const rect = el.getBoundingClientRect();
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    const ctx = canvas.getContext("2d")!;

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: 2_500_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

    // Tick through all features
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const p = feature.properties;

      // Update state synchronously-ish
      setPlaybackIndex(i);
      setVisibleEventIds((s) => {
        const copy = new Set(s ?? []);
        copy.add(p.event_id);
        return copy;
      });
      setPulsingEvents([
        { id: p.event_id, lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0], color: p.color },
      ]);
      setPlaybackDate(p.date_sort);
      processFeatureForTracking(feature);
      setChatEntries((prev) => [...prev, featureToChatEntry(feature)]);

      setExportProgress((i + 1) / features.length);

      // Wait for render
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Capture frame
      try {
        const shot = await html2canvas(el, {
          useCORS: true,
          backgroundColor: "#0a0d12",
          scale: 1,
          logging: false,
        });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(shot, 0, 0, canvas.width, canvas.height);
      } catch {
        // Skip frame on error
      }

      // Hold frame for consistent timing
      await new Promise((r) => setTimeout(r, frameDelay));
    }

    // Stop recording
    recorder.stop();
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    // Download
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ancestry-timelapse-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);

    setIsExporting(false);
    setExportProgress(0);
  }, [stopTimer, processFeatureForTracking]);

  /* ---- Alive count (derived) ---- */
  const aliveCount = useMemo(() => {
    if (!playbackDate) return 0;
    let count = 0;
    birthMapRef.current.forEach((birthDate, personId) => {
      if (birthDate <= playbackDate) {
        const deathDate = deathMapRef.current.get(personId);
        if (!deathDate || deathDate > playbackDate) {
          count++;
        }
      }
    });
    return count;
    // Re-derive when chatEntries changes (proxy for birth/death map changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackDate, chatEntries.length]);

  /* ---- Derived ---- */
  const timelapseActive = visibleEventIds !== null;
  const features = sortedRef.current;
  const progress =
    features.length > 0 && playbackIndex >= 0 ? (playbackIndex + 1) / features.length : 0;
  const cur = playbackIndex >= 0 ? features[playbackIndex] : null;
  const currentLabel = cur
    ? `${cur.properties.date_sort?.slice(0, 4) ?? "?"} — ${cur.properties.person_name}, ${cur.properties.event_label}`
    : "";

  const displayTypes = useMemo(
    () => eventTypes.filter((et) => ["BIRT", "DEAT", "MARR", "DIV", "IMMI", "RESI", "BURI", "CENS"].includes(et.code)),
    [eventTypes]
  );

  return (
    <div className="h-full flex flex-col page-enter">
      {/* Filter bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-5 py-2 flex-wrap border-b"
        style={{ background: "var(--bg-base)", borderColor: "var(--border)" }}
      >
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Events
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {displayTypes.map((et) => {
            const isActive = activeTypes.includes(et.code);
            return (
              <button
                key={et.code}
                onClick={() => handleToggleType(et.code)}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: isActive ? et.color : "transparent",
                  color: isActive ? "#fff" : et.color,
                  border: `1.5px solid ${et.color}`,
                  opacity: isActive ? 1 : 0.5,
                }}
              >
                {et.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map + overlays (recording container) */}
      <div className="flex-1 min-h-0 relative" ref={recordingRef}>
        <MapView
          geojson={geoData}
          selectedEventId={selectedEventId}
          onSelectEvent={handleSelectEvent}
          visibleEventIds={visibleEventIds}
          pulsingEvents={pulsingEvents}
          timelapseActive={timelapseActive}
        />

        {/* Date overlay */}
        <PlaybackDateDisplay date={playbackDate} aliveCount={aliveCount} />

        {/* Event chat */}
        {timelapseActive && (
          <EventChatPanel entries={chatEntries} aliveCount={aliveCount} />
        )}

        {/* Export progress overlay */}
        {isExporting && (
          <div
            className="absolute inset-0 z-[1000] flex items-center justify-center"
            style={{ background: "rgba(10, 13, 18, 0.7)" }}
          >
            <div className="text-center">
              <div
                className="text-xl font-light mb-3"
                style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}
              >
                Exporting Video...
              </div>
              <div className="w-64 h-2 rounded-full overflow-hidden mx-auto" style={{ background: "var(--bg-surface)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${exportProgress * 100}%`, background: "var(--gold)" }}
                />
              </div>
              <div className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                {Math.round(exportProgress * 100)}% — Frame {Math.round(exportProgress * features.length)} / {features.length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timelapse controls */}
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
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* Timeline */}
      <div className="h-[30%] min-h-[160px] border-t" style={{ borderColor: "var(--border)" }}>
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
  );
}
