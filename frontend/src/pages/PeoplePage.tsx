import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store";
import { fetchPersons } from "../api/client";
import type { PersonSummary } from "../api/types";

function fuzzyFilter(persons: PersonSummary[], query: string): PersonSummary[] {
  const q = query.toLowerCase().trim();
  if (!q) return persons;
  const tokens = q.split(/\s+/).filter(Boolean);
  return persons.filter((p) => {
    const name = p.display_name.toLowerCase();
    const first = (p.first_name || "").toLowerCase();
    const last = (p.last_name || "").toLowerCase();
    return tokens.every(
      (tok) => name.includes(tok) || first.includes(tok) || last.includes(tok)
    );
  });
}

export default function PeoplePage() {
  const persons = useAppStore((s) => s.persons);
  const stats = useAppStore((s) => s.stats);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "events">("name");
  const [apiResults, setApiResults] = useState<PersonSummary[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Debounced API search — queries the FULL database, not just the 500 loaded
  useEffect(() => {
    if (!search.trim()) {
      setApiResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetchPersons({ search: search.trim(), limit: 100 })
        .then(setApiResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      // No search — show browsable list from preloaded persons
      const list = persons;
      return sortBy === "events"
        ? [...list].sort((a, b) => b.event_count - a.event_count)
        : list;
    }

    // Instant client-side fuzzy results from preloaded data
    const local = fuzzyFilter(persons, search);

    if (!apiResults) {
      // API hasn't responded yet — show local results
      return sortBy === "events"
        ? [...local].sort((a, b) => b.event_count - a.event_count)
        : local;
    }

    // Merge: API results (comprehensive) + any local-only extras
    const apiIds = new Set(apiResults.map((p) => p.id));
    const extra = local.filter((p) => !apiIds.has(p.id));
    let merged = [...apiResults, ...extra];

    if (sortBy === "events") {
      merged.sort((a, b) => b.event_count - a.event_count);
    }
    return merged;
  }, [persons, search, sortBy, apiResults]);

  const totalInDb = stats?.persons ?? persons.length;

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
              People
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {filtered.length} of {totalInDb} people
              {searching && <span style={{ color: "var(--gold)" }}> — searching full database...</span>}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "events")}
              className="text-sm rounded-lg border px-3 py-2 outline-none"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="name">Sort by name</option>
              <option value="events">Sort by events</option>
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm rounded-lg border px-3 py-2 outline-none w-64"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <PersonCard key={p.id} person={p} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-lg mb-2" style={{ color: "var(--text-secondary)" }}>
              No people found
            </div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Try adjusting your search
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonCard({ person }: { person: PersonSummary }) {
  const sexLabel = person.sex === "M" ? "Male" : person.sex === "F" ? "Female" : null;

  return (
    <Link
      to={`/people/${person.id}`}
      className="block rounded-xl border p-4 transition-all duration-150 group"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-card-hover)";
        e.currentTarget.style.borderColor = "var(--border-light)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-card)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
          style={{
            background: person.sex === "M" ? "rgba(80, 136, 197, 0.15)" : person.sex === "F" ? "rgba(197, 80, 136, 0.15)" : "var(--bg-surface)",
            color: person.sex === "M" ? "#5088c5" : person.sex === "F" ? "#c55088" : "var(--text-muted)",
          }}
        >
          {(person.first_name?.[0] ?? "?").toUpperCase()}
        </div>
        {person.needs_review && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(200, 163, 78, 0.15)", color: "var(--gold)" }}
          >
            Review
          </span>
        )}
      </div>

      <h3
        className="text-sm font-semibold mb-0.5 group-hover:text-[var(--gold)] transition-colors"
        style={{ color: "var(--text-primary)" }}
      >
        {person.display_name}
      </h3>

      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
        {sexLabel && <span>{sexLabel}</span>}
        <span>{person.event_count} events</span>
        {person.conflict_count > 0 && (
          <span style={{ color: "#e07070" }}>
            {person.conflict_count} conflict{person.conflict_count > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </Link>
  );
}
