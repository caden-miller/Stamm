import { useState, useMemo, useRef, useEffect } from "react";
import type { EventTypeOut, StatsOut, PersonSummary } from "../api/types";

interface Props {
  eventTypes: EventTypeOut[];
  activeTypes: string[];
  onToggleType: (code: string) => void;
  onSearchChange: (query: string) => void;
  onSelectPerson: (id: number) => void;
  searchQuery: string;
  allPersons: PersonSummary[];
  stats: StatsOut | null;
}

/* ---- Fuzzy matching ---- */

function fuzzyScore(query: string, person: PersonSummary): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const name = person.display_name.toLowerCase();
  const first = (person.first_name || "").toLowerCase();
  const last = (person.last_name || "").toLowerCase();

  // Exact full match
  if (name === q) return 100;

  // Starts with query
  if (name.startsWith(q) || first.startsWith(q) || last.startsWith(q)) return 90;

  // All tokens present as substrings
  const tokens = q.split(/\s+/).filter(Boolean);
  const fields = [name, first, last];
  const tokenMatches = tokens.filter((tok) =>
    fields.some((f) => f.includes(tok))
  );

  if (tokenMatches.length === tokens.length) return 70;
  if (tokenMatches.length > 0) return 30 * (tokenMatches.length / tokens.length);

  // Character-subsequence match (handles "jhn" → "john")
  let qi = 0;
  for (let i = 0; i < name.length && qi < q.length; i++) {
    if (name[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 15;

  return 0;
}

export default function FilterBar({
  eventTypes,
  activeTypes,
  onToggleType,
  onSearchChange,
  onSelectPerson,
  searchQuery,
  allPersons,
  stats,
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fuzzy-filtered results
  const results = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return allPersons
      .map((p) => ({ person: p, score: fuzzyScore(searchQuery, p) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => r.person);
  }, [searchQuery, allPersons]);

  // Only show the main event types
  const displayTypes = eventTypes.filter((et) =>
    ["BIRT", "DEAT", "MARR", "DIV", "IMMI", "RESI", "BURI", "CENS"].includes(et.code)
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border-b border-zinc-700 flex-wrap">
      {/* App title */}
      <h1 className="text-sm font-bold text-zinc-100 tracking-wide mr-2 shrink-0">
        Stamm
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

      {/* Person search with fuzzy dropdown */}
      <div className="relative" ref={wrapperRef}>
        <div className="flex gap-1.5 items-center">
          <input
            type="text"
            placeholder="Search person..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setShowDropdown(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowDropdown(false);
              if (e.key === "Enter" && results.length > 0) {
                onSelectPerson(results[0].id);
                setShowDropdown(false);
              }
            }}
            className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs
                       placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 w-48"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange("");
                setShowDropdown(false);
              }}
              className="text-zinc-500 text-xs hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>

        {/* Fuzzy results dropdown */}
        {showDropdown && searchQuery.trim() && (
          <div className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto bg-zinc-800 border border-zinc-600 rounded shadow-xl z-50">
            {results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">
                No matches found
              </div>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPerson(p.id);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-700 transition border-b border-zinc-700/50 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-200 font-medium">
                      {p.display_name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {p.event_count} events
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.sex && (
                      <span className="text-xs text-zinc-500">
                        {p.sex === "M" ? "Male" : p.sex === "F" ? "Female" : ""}
                      </span>
                    )}
                    {p.needs_review && (
                      <span className="text-xs text-amber-400">needs review</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
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
