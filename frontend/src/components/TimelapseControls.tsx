/**
 * TimelapseControls — play/pause, speed dial, progress bar, and
 * a readout of the current event being shown.
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
}: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-zinc-950/90 border-t border-zinc-700">
      {/* Play / Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="w-8 h-8 flex items-center justify-center rounded-full
                   bg-amber-500 hover:bg-amber-400 text-zinc-950 transition shrink-0"
        title={isPlaying ? "Pause" : "Play timelapse"}
      >
        {isPlaying ? (
          /* Pause icon */
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          /* Play icon */
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        className="text-zinc-500 hover:text-zinc-300 text-xs transition"
        title="Reset"
      >
        Reset
      </button>

      {/* Progress bar */}
      <div
        className="flex-1 h-1.5 bg-zinc-800 rounded-full cursor-pointer relative group"
        onClick={(e) => {
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
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition
              ${speed === opt.value
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-600 hover:text-zinc-400"
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
