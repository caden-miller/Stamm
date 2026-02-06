import { useEffect, useRef, useCallback } from "react";
import { Timeline as VisTimeline } from "vis-timeline/standalone";
import { DataSet } from "vis-data/standalone";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import type { TimelineResponse } from "../api/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  data: TimelineResponse | null;
  selectedEventId: number | null;
  onSelectEvent: (eventId: number | null) => void;
  onRangeChanged: (start: string, end: string) => void;
  /** ISO date string for the timelapse playback cursor (null = hidden). */
  playbackDate: string | null;
  /** Set of event IDs currently revealed in timelapse (null = show all). */
  revealedIds: Set<number> | null;
}

const CURSOR_ID = "playback-cursor";

export default function Timeline({
  data,
  selectedEventId,
  onSelectEvent,
  onRangeChanged,
  playbackDate,
  revealedIds,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<VisTimeline | null>(null);
  const itemsRef = useRef<DataSet<any>>(new DataSet([]));
  const groupsRef = useRef<DataSet<any>>(new DataSet([]));
  const cursorAdded = useRef(false);

  // Create timeline once
  useEffect(() => {
    if (!containerRef.current || timelineRef.current) return;

    const tl = new VisTimeline(
      containerRef.current,
      itemsRef.current as any,
      groupsRef.current as any,
      {
        orientation: { axis: "top" },
        stack: true,
        showCurrentTime: false,
        zoomMin: 1000 * 60 * 60 * 24 * 365,
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 200,
        margin: { item: { horizontal: 4, vertical: 4 } },
        tooltip: { followMouse: true },
        maxHeight: "100%",
        min: new Date("1800-01-01"),
        max: new Date("2030-01-01"),
      }
    );

    timelineRef.current = tl;

    return () => {
      tl.destroy();
      timelineRef.current = null;
    };
  }, []);

  // Attach event handlers
  const onSelectEventRef = useRef(onSelectEvent);
  onSelectEventRef.current = onSelectEvent;
  const onRangeChangedRef = useRef(onRangeChanged);
  onRangeChangedRef.current = onRangeChanged;

  useEffect(() => {
    const tl = timelineRef.current;
    if (!tl) return;

    const selectHandler = (props: { items: number[] }) => {
      const id = props.items.length > 0 ? props.items[0] : null;
      onSelectEventRef.current(id);
    };

    const rangeHandler = (props: { start: Date; end: Date }) => {
      onRangeChangedRef.current(
        props.start.toISOString().slice(0, 10),
        props.end.toISOString().slice(0, 10)
      );
    };

    tl.on("select", selectHandler);
    tl.on("rangechanged", rangeHandler);

    return () => {
      tl.off("select", selectHandler);
      tl.off("rangechanged", rangeHandler);
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (!data) return;
    itemsRef.current.clear();
    groupsRef.current.clear();

    const items = data.items.map((item) => ({
      id: item.id,
      content: item.content,
      start: item.start,
      end: item.end ?? undefined,
      group: item.group,
      className: item.className,
      style: item.style,
      title: item.title,
    }));

    const groups = data.groups.map((g) => ({
      id: g.id,
      content: g.content,
      order: g.order ?? g.id,
    }));

    if (items.length > 0) {
      itemsRef.current.add(items);
      groupsRef.current.add(groups);
      timelineRef.current?.fit({ animation: false });
    }
  }, [data]);

  // Dim/reveal items during timelapse
  useEffect(() => {
    if (!data) return;
    const updates: any[] = [];
    for (const item of data.items) {
      const shouldHide = revealedIds !== null && !revealedIds.has(item.id);
      const existing = itemsRef.current.get(item.id) as any;
      if (!existing) continue;
      const base = item.className ?? "";
      const cls = shouldHide
        ? `${base} timelapse-hidden`
        : base;
      if (existing.className !== cls) {
        updates.push({ id: item.id, className: cls });
      }
    }
    if (updates.length > 0) {
      itemsRef.current.update(updates);
    }
  }, [revealedIds, data]);

  // Playback cursor
  useEffect(() => {
    const tl = timelineRef.current;
    if (!tl) return;

    if (playbackDate) {
      const d = new Date(playbackDate);
      if (!cursorAdded.current) {
        try {
          tl.addCustomTime(d, CURSOR_ID);
        } catch {
          tl.setCustomTime(d, CURSOR_ID);
        }
        cursorAdded.current = true;

        // Style the cursor element
        const el = (tl as any).dom?.container?.querySelector(
          `.vis-custom-time[data-custom-time-id="${CURSOR_ID}"]`
        ) as HTMLElement | null;
        if (el) el.classList.add("playback-cursor");
      } else {
        tl.setCustomTime(d, CURSOR_ID);
      }
      // Keep cursor in view
      tl.moveTo(d, { animation: { duration: 300, easingFunction: "easeInOutQuad" } });
    } else if (cursorAdded.current) {
      try {
        tl.removeCustomTime(CURSOR_ID);
      } catch { /* ignore if already removed */ }
      cursorAdded.current = false;
    }
  }, [playbackDate]);

  // Highlight selected item
  const setSelection = useCallback((id: number | null) => {
    const tl = timelineRef.current;
    if (!tl) return;
    tl.setSelection(id != null ? [id] : []);
  }, []);

  useEffect(() => {
    setSelection(selectedEventId);
  }, [selectedEventId, setSelection]);

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />
      {(!data || data.items.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 pointer-events-none">
          No dated events to display
        </div>
      )}
    </div>
  );
}
