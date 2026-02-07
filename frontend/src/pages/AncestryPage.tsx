import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAppStore } from "../store";
import { fetchRelationshipPath, fetchPersons } from "../api/client";
import type { PersonSummary, RelationshipPath } from "../api/types";
import FamilyTreeView from "../components/FamilyTreeView";

type Tab = "tree" | "path";

export default function AncestryPage() {
  const persons = useAppStore((s) => s.persons);
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("person");

  const [tab, setTab] = useState<Tab>("tree");

  // --- Path Finder state ---
  const [person1Id, setPerson1Id] = useState<number | null>(
    preselected ? Number(preselected) : null
  );
  const [person2Id, setPerson2Id] = useState<number | null>(null);
  const [person1Data, setPerson1Data] = useState<PersonSummary | undefined>(undefined);
  const [person2Data, setPerson2Data] = useState<PersonSummary | undefined>(undefined);
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");
  const [path, setPath] = useState<RelationshipPath | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Family Tree state ---
  const [treePersonId, setTreePersonId] = useState<number | null>(null);
  const [treePersonData, setTreePersonData] = useState<PersonSummary | undefined>(undefined);
  const [treeSearch, setTreeSearch] = useState("");

  const filtered1 = useMemo(() => filterPersons(persons, search1), [persons, search1]);
  const filtered2 = useMemo(() => filterPersons(persons, search2), [persons, search2]);
  const filteredTree = useMemo(() => filterPersons(persons, treeSearch), [persons, treeSearch]);

  const person1 = person1Data ?? persons.find((p) => p.id === person1Id);
  const person2 = person2Data ?? persons.find((p) => p.id === person2Id);
  const treePerson = treePersonData ?? persons.find((p) => p.id === treePersonId);

  // Auto-switch to path tab if preselected person is provided
  useEffect(() => {
    if (preselected) setTab("path");
  }, [preselected]);

  const findPath = async () => {
    if (!person1Id || !person2Id) return;
    setLoading(true);
    try {
      const result = await fetchRelationshipPath(person1Id, person2Id);
      setPath(result);
    } catch {
      alert("Failed to find relationship path.");
    } finally {
      setLoading(false);
    }
  };

  const relationshipColor = (rel: string | null) => {
    switch (rel) {
      case "parent": return "#4e9e6e";
      case "child": return "#5088c5";
      case "sibling": return "var(--gold)";
      case "spouse": return "#c55088";
      default: return "var(--text-muted)";
    }
  };

  const relationshipIcon = (rel: string | null) => {
    switch (rel) {
      case "parent": return "↑";
      case "child": return "↓";
      case "sibling": return "↔";
      case "spouse": return "♥";
      default: return "→";
    }
  };

  return (
    <div className="h-full overflow-y-auto page-enter">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1
            className="text-3xl font-normal mb-1"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            Ancestry
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Explore family trees or find relationship paths between people.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--bg-surface)" }}>
          {([["tree", "Family Tree"], ["path", "Path Finder"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 text-sm font-medium py-2 rounded-lg transition-all"
              style={{
                background: tab === key ? "var(--bg-card)" : "transparent",
                color: tab === key ? "var(--gold)" : "var(--text-muted)",
                boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ---- Family Tree tab ---- */}
        {tab === "tree" && (
          <div>
            {!treePersonId ? (
              <PersonSelector
                label="Select a person to explore their family tree"
                persons={filteredTree}
                selected={treePerson}
                search={treeSearch}
                onSearchChange={setTreeSearch}
                onSelect={(id, data) => { setTreePersonId(id); setTreePersonData(data); }}
              />
            ) : (
              <>
                <div
                  className="flex items-center justify-between rounded-xl border px-4 py-3 mb-4"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <div>
                    <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
                      Root Person
                    </div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {treePerson?.display_name ?? "Loading..."}
                    </div>
                  </div>
                  <button
                    onClick={() => { setTreePersonId(null); setTreePersonData(undefined); setTreeSearch(""); }}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--gold)", background: "rgba(200,163,78,0.1)" }}
                  >
                    Change
                  </button>
                </div>
                <div
                  className="rounded-xl border p-2"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <FamilyTreeView
                    rootPersonId={treePersonId}
                    rootPersonName={treePerson?.display_name ?? ""}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ---- Path Finder tab ---- */}
        {tab === "path" && (
          <div>
            {/* Person selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <PersonSelector
                label="Person 1"
                persons={filtered1}
                selected={person1}
                search={search1}
                onSearchChange={setSearch1}
                onSelect={(id, data) => { setPerson1Id(id); setPerson1Data(data); }}
              />
              <PersonSelector
                label="Person 2"
                persons={filtered2}
                selected={person2}
                search={search2}
                onSearchChange={setSearch2}
                onSelect={(id, data) => { setPerson2Id(id); setPerson2Data(data); }}
              />
            </div>

            {/* Find button */}
            <button
              onClick={findPath}
              disabled={!person1Id || !person2Id || loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--gold)", color: "var(--bg-deep)" }}
            >
              {loading ? "Searching..." : "Find Relationship"}
            </button>

            {/* Results */}
            {path && (
              <div className="mt-8">
                <div
                  className="text-center rounded-xl border p-6 mb-6"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <div
                    className="text-2xl font-normal mb-1"
                    style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}
                  >
                    {path.relationship_description}
                  </div>
                  {path.path_found && (
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {path.path_length} {path.path_length === 1 ? "person" : "people"} in path
                    </div>
                  )}
                </div>

                {path.path_found && path.path.length > 0 && (
                  <div className="space-y-1">
                    {path.path.map((node, index) => (
                      <div key={node.id}>
                        <Link
                          to={`/people/${node.id}`}
                          className="block rounded-xl border p-4 transition-all"
                          style={{
                            background: "var(--bg-card)",
                            borderColor: "var(--border)",
                            borderLeftWidth: "4px",
                            borderLeftColor:
                              index === 0
                                ? "#5088c5"
                                : index === path.path.length - 1
                                ? "#4e9e6e"
                                : relationshipColor(node.relationship_to_next),
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                        >
                          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {node.display_name}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {node.sex === "M" ? "Male" : node.sex === "F" ? "Female" : "Unknown"}
                          </div>
                        </Link>

                        {node.relationship_to_next && (
                          <div className="flex items-center justify-center py-2">
                            <div
                              className="text-xl"
                              style={{ color: relationshipColor(node.relationship_to_next) }}
                            >
                              {relationshipIcon(node.relationship_to_next)}
                            </div>
                            <span
                              className="text-xs ml-2 capitalize"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {node.relationship_to_next}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!path.path_found && (
                  <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
                    No direct relationship path found.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Person selector ---- */

function PersonSelector({
  label,
  persons,
  selected,
  search,
  onSearchChange,
  onSelect,
}: {
  label: string;
  persons: PersonSummary[];
  selected: PersonSummary | undefined;
  search: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: number | null, data?: PersonSummary) => void;
}) {
  const [apiResults, setApiResults] = useState<PersonSummary[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Debounced API search for people beyond preloaded set
  useEffect(() => {
    if (!search.trim()) {
      setApiResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetchPersons({ search: search.trim(), limit: 50 })
        .then(setApiResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Merge local + API results
  const merged = useMemo(() => {
    if (!search.trim()) return persons;
    if (!apiResults) return persons; // API not back yet, show local filtered
    const localIds = new Set(persons.map((p) => p.id));
    const extra = apiResults.filter((p) => !localIds.has(p.id));
    return [...persons, ...extra];
  }, [persons, search, apiResults]);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>

      {selected ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {selected.display_name}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {selected.sex === "M" ? "Male" : selected.sex === "F" ? "Female" : ""}
            </div>
          </div>
          <button
            onClick={() => { onSelect(null, undefined); onSearchChange(""); }}
            className="text-xs"
            style={{ color: "var(--gold)" }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name..."
            className="w-full text-sm rounded-lg border px-3 py-2 mb-2 outline-none"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          {searching && (
            <div className="text-xs py-1 mb-1" style={{ color: "var(--gold)" }}>Searching...</div>
          )}
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {merged.slice(0, 50).map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id, p)}
                className="w-full text-left text-sm px-2 py-1.5 rounded transition-colors"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {p.display_name}
              </button>
            ))}
            {merged.length === 0 && search && !searching && (
              <div className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No matches</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function filterPersons(persons: PersonSummary[], query: string): PersonSummary[] {
  const q = query.toLowerCase().trim();
  if (!q) return persons;
  return persons.filter((p) =>
    p.display_name.toLowerCase().includes(q)
  );
}
