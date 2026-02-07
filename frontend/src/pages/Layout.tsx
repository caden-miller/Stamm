import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useMemo, useRef, useEffect } from "react";
import { useAppStore } from "../store";
import { fetchPersons } from "../api/client";
import type { PersonSummary } from "../api/types";
import { useTheme } from "../hooks/useTheme";

/* ---- Fuzzy scoring (same algo as before) ---- */
function fuzzyScore(query: string, person: PersonSummary): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const name = person.display_name.toLowerCase();
  const first = (person.first_name || "").toLowerCase();
  const last = (person.last_name || "").toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q) || first.startsWith(q) || last.startsWith(q)) return 90;
  const tokens = q.split(/\s+/).filter(Boolean);
  const fields = [name, first, last];
  const matched = tokens.filter((tok) => fields.some((f) => f.includes(tok)));
  if (matched.length === tokens.length) return 70;
  if (matched.length > 0) return 30 * (matched.length / tokens.length);
  let qi = 0;
  for (let i = 0; i < name.length && qi < q.length; i++) {
    if (name[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 15;
  return 0;
}

/* ---- SVG icons ---- */
const icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  explore: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  people: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  conflicts: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  ancestry: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6" /><path d="M12 18v4" /><path d="M4.93 10.93l2.83 2.83" />
      <path d="M16.24 10.93l-2.83 2.83" /><circle cx="12" cy="12" r="4" />
    </svg>
  ),
  locations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: icons.dashboard, end: true },
  { to: "/explore", label: "Explore", icon: icons.explore },
  { to: "/people", label: "People", icon: icons.people },
  { to: "/ancestry", label: "Ancestry", icon: icons.ancestry },
  { to: "/locations", label: "Locations", icon: icons.locations },
  { to: "/conflicts", label: "Conflicts", icon: icons.conflicts },
];

export default function Layout() {
  const navigate = useNavigate();
  const persons = useAppStore((s) => s.persons);
  const stats = useAppStore((s) => s.stats);
  const conflicts = useAppStore((s) => s.conflicts);
  const unresolvedCount = conflicts.filter((c) => !c.resolution).length;
  const { theme, toggle: toggleTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [apiResults, setApiResults] = useState<PersonSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced API search for people beyond the preloaded set
  useEffect(() => {
    if (!searchQuery.trim()) {
      setApiResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetchPersons({ search: searchQuery.trim(), limit: 20 })
        .then(setApiResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const results = useMemo(() => {
    if (!searchQuery.trim()) return [];
    // Client-side fuzzy results from preloaded persons
    const local = persons
      .map((p) => ({ person: p, score: fuzzyScore(searchQuery, p) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => r.person);

    if (!apiResults) return local;

    // Merge API results (may include people not in preloaded set)
    const localIds = new Set(local.map((p) => p.id));
    const extra = apiResults.filter((p) => !localIds.has(p.id));
    return [...local, ...extra].slice(0, 15);
  }, [searchQuery, persons, apiResults]);

  const handleSelectPerson = (id: number) => {
    setSearchQuery("");
    setShowSearch(false);
    navigate(`/people/${id}`);
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-deep)" }}>
      {/* ---- Top Navigation ---- */}
      <header
        className="shrink-0 flex items-center gap-1 px-5 h-14 border-b"
        style={{ background: "var(--bg-base)", borderColor: "var(--border)" }}
      >
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2.5 mr-6 shrink-0 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--gold)" }}
          >
            <svg width="20" height="20" viewBox="0 0 36 36" fill="#fff" xmlns="http://www.w3.org/2000/svg">
              <path d="M30.6,11.7C29.2,5.8,24,1.7,18,1.7c-7.2,0-13,5.8-13,13c0,6.8,5.3,12.4,12,12.9v5c0,0.6,0.4,1,1,1s1-0.4,1-1v-5v-2V22 c0,0,0,0,0-0.1v-3.6l4.7-4.7c0.4-0.4,0.4-1,0-1.4c-0.4-0.4-1-0.4-1.4,0L19,15.6v-3l-3.3-3.3c-0.4-0.4-1-0.4-1.4,0 c-0.4,0.4-0.4,1,0,1.4l2.7,2.7v6.2l-3.8-3.8c-0.4-0.4-1-0.4-1.4,0c-0.4,0.4-0.4,1,0,1.4l5.2,5.2v3.2c-5.6-0.5-10-5.2-10-10.9 c0-6.1,4.9-11,11-11s11,4.9,11,11c0,4.9-3.3,9.2-8,10.6v2.1C28,25.7,32.3,18.7,30.6,11.7z" />
            </svg>
          </div>
          <span
            className="text-lg tracking-wide hidden sm:inline"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            Stamm
          </span>
        </NavLink>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: "rgba(200, 163, 78, 0.1)" } : {}
              }
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
              {item.label === "Conflicts" && (unresolvedCount + (stats?.persons_needing_review ?? 0)) > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(197, 80, 80, 0.2)", color: "#e07070" }}
                >
                  {unresolvedCount + (stats?.persons_needing_review ?? 0)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative" ref={searchRef}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all"
            style={{
              background: "var(--bg-surface)",
              borderColor: showSearch ? "var(--gold-dim)" : "var(--border)",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>{icons.search}</span>
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearch(true);
              }}
              onFocus={() => { if (searchQuery.trim()) setShowSearch(true); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSearch(false);
                if (e.key === "Enter" && results.length > 0) handleSelectPerson(results[0].id);
              }}
              className="bg-transparent border-none outline-none text-sm w-44"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          {showSearch && searchQuery.trim() && (
            <div
              className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-2xl z-50"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              {results.length === 0 ? (
                <div className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                  {searching ? "Searching..." : "No matches found"}
                </div>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPerson(p.id)}
                    className="w-full text-left px-4 py-2.5 transition-colors border-b last:border-0"
                    style={{ borderColor: "var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {p.display_name}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {p.event_count} events
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.sex && (
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {p.sex === "M" ? "Male" : p.sex === "F" ? "Female" : ""}
                        </span>
                      )}
                      {p.needs_review && (
                        <span className="text-xs" style={{ color: "var(--gold)" }}>needs review</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Stats badge */}
        {stats && (
          <div className="hidden lg:flex items-center gap-4 ml-4 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{stats.persons} people</span>
            <span>{stats.events} events</span>
          </div>
        )}
      </header>

      {/* ---- Page Content ---- */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
