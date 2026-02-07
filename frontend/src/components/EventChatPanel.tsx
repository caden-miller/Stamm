import { useEffect, useRef } from "react";

export interface ChatEntry {
  eventId: number;
  personId: number;
  personName: string;
  eventType: string;
  eventLabel: string;
  color: string;
  dateSorted: string;
  dateRaw: string | null;
  locationName: string;
}

interface Props {
  entries: ChatEntry[];
  aliveCount: number;
}

function shortDate(iso: string | null, raw: string | null): string {
  if (raw) return raw;
  if (!iso) return "Unknown date";
  return iso.slice(0, 10);
}

export default function EventChatPanel({ entries, aliveCount }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) return null;

  // Show last 80 entries to avoid perf issues
  const visible = entries.slice(-80);

  return (
    <div className="event-chat-panel">
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Events
        </span>
        <span className="text-xs" style={{ color: "var(--gold)" }}>
          {aliveCount} alive
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {visible.map((e, i) => (
          <div
            key={e.eventId}
            className="chat-entry flex items-start gap-2 px-2 py-1.5 rounded-lg"
            style={{
              animationDelay: `${Math.max(0, i - visible.length + 5) * 30}ms`,
            }}
          >
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: e.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {e.personName}
                </span>
                <span
                  className="text-[10px] font-semibold shrink-0"
                  style={{ color: e.color }}
                >
                  {e.eventLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span>{shortDate(e.dateSorted, e.dateRaw)}</span>
                {e.locationName && (
                  <>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span className="truncate">{e.locationName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
