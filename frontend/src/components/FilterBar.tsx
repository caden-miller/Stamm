import { useState } from "react";
import type { EventTypeOut, StatsOut } from "../api/types";

interface Props {
  eventTypes: EventTypeOut[];
  activeTypes: string[];
  onToggleType: (code: string) => void;
  onSearch: (query: string) => void;
  stats: StatsOut | null;
}

export default function FilterBar({
  eventTypes,
  activeTypes,
  onToggleType,
  onSearch,
  stats,
}: Props) {
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    onSearch(query.trim());
  };

  // Only show the main event types (not all 18)
  const displayTypes = eventTypes.filter((et) =>
    ["BIRT", "DEAT", "MARR", "DIV", "IMMI", "RESI", "BURI", "CENS"].includes(et.code)
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border-b border-zinc-700 flex-wrap">
      {/* App title */}
      <h1 className="text-sm font-bold text-zinc-100 tracking-wide mr-2 shrink-0">
        Ancestry Viewer
      </h1>

      <div className="h-5 w-px bg-zinc-700 shrink-0" />

      {/* Event type toggles */}
      <div className="flex gap-1.5 flex-wrap">
        {displayTypes.map((et) => {
          const isActive = activeTypes.includes(et.code);
          return (
            <button
              key={et.code}
              onClick={() => onToggleType(et.code)}
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

      <div className="h-5 w-px bg-zinc-700 shrink-0" />

      {/* Person search */}
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          placeholder="Search person..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs
                     placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 w-40"
        />
        <button
          onClick={handleSearch}
          className="px-2.5 py-1 rounded bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition"
        >
          Search
        </button>
        {query && (
          <button
            onClick={() => {
              setQuery("");
              onSearch("");
            }}
            className="text-zinc-500 text-xs hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stats badge */}
      {stats && (
        <>
          <div className="ml-auto" />
          <div className="flex gap-3 text-xs text-zinc-500">
            <span>{stats.persons} persons</span>
            <span>{stats.events} events</span>
            <span>{stats.locations_geocoded} mapped</span>
            {stats.conflicts_unresolved > 0 && (
              <span className="text-amber-400">
                {stats.conflicts_unresolved} conflicts
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
