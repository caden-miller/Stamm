/**
 * TimelapseControls — play/pause, speed dial, progress bar,
 * a readout of the current event, and export button.
 */

interface Props {
  isPlaying: boolean;
  progress: number;        // 0–1
  currentLabel: string;    // e.g. "1905 — Hazel Edna Schwenk, Birth"
  speed: number;           // ms between ticks
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (ms: number) => void;
  onSeek: (pct: number) => void;
  onExport?: () => void;
  isExporting?: boolean;
}

const SPEED_OPTIONS = [
  { label: "0.5x", value: 1600 },
  { label: "1x",   value: 800 },
  { label: "2x",   value: 400 },
  { label: "4x",   value: 200 },
];

export default function TimelapseControls({
  isPlaying,
  progress,
  currentLabel,
  speed,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onSeek,
  onExport,
  isExporting,
}: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-zinc-950/90 border-t border-zinc-700">
      {/* Play / Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={isExporting}
        className="w-8 h-8 flex items-center justify-center rounded-full
                   bg-amber-500 hover:bg-amber-400 text-zinc-950 transition shrink-0
                   disabled:opacity-40 disabled:cursor-not-allowed"
        title={isPlaying ? "Pause" : "Play timelapse"}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        disabled={isExporting}
        className="text-zinc-500 hover:text-zinc-300 text-xs transition disabled:opacity-40"
        title="Reset"
      >
        Reset
      </button>

      {/* Progress bar */}
      <div
        className="flex-1 h-1.5 bg-zinc-800 rounded-full cursor-pointer relative group"
        onClick={(e) => {
          if (isExporting) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSeek(pct);
        }}
      >
        <div
          className="h-full bg-amber-500 rounded-full transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-400
                     rounded-full opacity-0 group-hover:opacity-100 transition"
          style={{ left: `calc(${progress * 100}% - 6px)` }}
        />
      </div>

      {/* Current event label */}
      <div className="text-xs text-zinc-400 min-w-[200px] text-right truncate">
        {currentLabel || "Ready"}
      </div>

      {/* Speed selector */}
      <div className="flex gap-0.5 shrink-0">
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSpeedChange(opt.value)}
            disabled={isExporting}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition
              ${speed === opt.value
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-600 hover:text-zinc-400"
              } disabled:opacity-40`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Export button */}
      {onExport && (
        <button
          onClick={onExport}
          disabled={isExporting || isPlaying}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition shrink-0
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "rgba(200, 163, 78, 0.15)",
            color: "var(--gold)",
          }}
          title="Export timelapse as video"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {isExporting ? "Exporting..." : "Export"}
        </button>
      )}
    </div>
  );
}
