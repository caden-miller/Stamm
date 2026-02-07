import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store";
import { resolveConflict, fetchNeedsReviewPersons, markPersonReviewed } from "../api/client";
import type { ConflictOut, PersonSummary } from "../api/types";

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  error: { bg: "rgba(197, 80, 80, 0.06)", border: "rgba(197, 80, 80, 0.2)", text: "#e07070", badge: "rgba(197, 80, 80, 0.15)" },
  warning: { bg: "rgba(200, 163, 78, 0.06)", border: "rgba(200, 163, 78, 0.2)", text: "var(--gold)", badge: "rgba(200, 163, 78, 0.15)" },
  info: { bg: "rgba(80, 136, 197, 0.06)", border: "rgba(80, 136, 197, 0.2)", text: "#5088c5", badge: "rgba(80, 136, 197, 0.15)" },
};

type FilterMode = "unresolved" | "all" | "resolved" | "needs_review";

export default function ConflictsPage() {
  const conflicts = useAppStore((s) => s.conflicts);
  const updateConflict = useAppStore((s) => s.updateConflict);
  const refreshStats = useAppStore((s) => s.refreshStats);

  const [filter, setFilter] = useState<FilterMode>("unresolved");
  const [reviewPersons, setReviewPersons] = useState<PersonSummary[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadReviewPersons = useCallback(() => {
    setReviewLoading(true);
    fetchNeedsReviewPersons()
      .then(setReviewPersons)
      .finally(() => setReviewLoading(false));
  }, []);

  useEffect(() => {
    if (filter === "needs_review") {
      loadReviewPersons();
    }
  }, [filter, loadReviewPersons]);

  const filtered = conflicts.filter((c) => {
    if (filter === "unresolved") return !c.resolution;
    if (filter === "resolved") return !!c.resolution;
    if (filter === "needs_review") return false; // handled separately
    return true;
  });

  const unresolvedCount = conflicts.filter((c) => !c.resolution).length;
  const resolvedCount = conflicts.filter((c) => c.resolution).length;

  const handleResolved = (updated: ConflictOut) => {
    updateConflict(updated);
    refreshStats();
  };

  const handleMarkReviewed = async (personId: number) => {
    try {
      await markPersonReviewed(personId, true);
      setReviewPersons((prev) => prev.filter((p) => p.id !== personId));
      refreshStats();
    } catch {
      alert("Failed to mark as reviewed.");
    }
  };

  return (
    <div className="h-full overflow-y-auto page-enter">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl font-normal mb-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Conflicts & Review
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {unresolvedCount} unresolved, {resolvedCount} resolved
            </p>
          </div>

          {/* Filter tabs */}
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            {(["unresolved", "needs_review", "all", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: filter === f ? "var(--bg-card-hover)" : "var(--bg-card)",
                  color: filter === f ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {f === "needs_review" ? "Needs Review" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Needs Review tab */}
        {filter === "needs_review" ? (
          reviewLoading ? (
            <div className="text-center py-20">
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
            </div>
          ) : reviewPersons.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-lg mb-2" style={{ color: "var(--text-secondary)" }}>
                No people need review
              </div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                All records have been reviewed!
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewPersons.map((person) => (
                <NeedsReviewRow
                  key={person.id}
                  person={person}
                  onMarkReviewed={handleMarkReviewed}
                />
              ))}
            </div>
          )
        ) : (
          /* Conflict list */
          filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-lg mb-2" style={{ color: "var(--text-secondary)" }}>
                {filter === "unresolved" ? "No unresolved conflicts" : "No conflicts found"}
              </div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                {filter === "unresolved" ? "All data looks clean!" : "Try a different filter"}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => (
                <ConflictRow
                  key={c.id}
                  conflict={c}
                  onResolved={handleResolved}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function NeedsReviewRow({
  person,
  onMarkReviewed,
}: {
  person: PersonSummary;
  onMarkReviewed: (personId: number) => void;
}) {
  const [marking, setMarking] = useState(false);

  const handleClick = async () => {
    setMarking(true);
    await onMarkReviewed(person.id);
    setMarking(false);
  };

  return (
    <div
      className="rounded-xl border p-5 flex items-center justify-between gap-4"
      style={{
        background: "rgba(200, 163, 78, 0.06)",
        borderColor: "rgba(200, 163, 78, 0.2)",
      }}
    >
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{ background: "rgba(200, 163, 78, 0.15)", color: "var(--gold)" }}
          >
            needs review
          </span>
          <Link
            to={`/people/${person.id}`}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--text-primary)" }}
          >
            {person.display_name}
          </Link>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
          {person.sex && <span>{person.sex === "M" ? "Male" : person.sex === "F" ? "Female" : ""}</span>}
          <span>{person.event_count} events</span>
          {person.conflict_count > 0 && (
            <span style={{ color: "#e07070" }}>{person.conflict_count} unresolved conflicts</span>
          )}
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={marking}
        className="px-4 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50 shrink-0"
        style={{ background: "#4e9e6e" }}
      >
        {marking ? "Marking..." : "Mark Reviewed"}
      </button>
    </div>
  );
}

function ConflictRow({
  conflict,
  onResolved,
}: {
  conflict: ConflictOut;
  onResolved: (c: ConflictOut) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const colors = SEVERITY_COLORS[conflict.severity] ?? SEVERITY_COLORS.info;
  const isResolved = !!conflict.resolution;

  const handleResolve = async (resolution: string) => {
    setResolving(true);
    try {
      const updated = await resolveConflict(conflict.id, { resolution, notes: notes || undefined });
      onResolved(updated);
      setShowActions(false);
      setNotes("");
    } catch {
      alert("Failed to resolve conflict.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className="rounded-xl border p-5 transition-colors"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        opacity: isResolved ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{ background: colors.badge, color: colors.text }}
          >
            {conflict.severity}
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {conflict.conflict_type.replace(/_/g, " ")}
          </span>
        </div>
        {isResolved && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(78, 158, 110, 0.15)", color: "#4e9e6e" }}>
            {conflict.resolution}
          </span>
        )}
      </div>

      <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
        {conflict.description}
      </p>

      <Link
        to={`/people/${conflict.person_id}`}
        className="text-sm font-medium hover:underline"
        style={{ color: "var(--gold)" }}
      >
        {conflict.person_name}
      </Link>

      {!isResolved && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: colors.border }}>
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="text-sm font-medium transition-colors"
              style={{ color: colors.text }}
            >
              Resolve conflict
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="w-full text-sm rounded-lg border px-3 py-2 resize-none outline-none"
                style={{
                  background: "var(--bg-base)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolve("confirmed")}
                  disabled={resolving}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                  style={{ background: "#4e9e6e" }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleResolve("rejected")}
                  disabled={resolving}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                  style={{ background: "#c55050" }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleResolve("needs_review")}
                  disabled={resolving}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                  style={{ background: "var(--gold-dim)" }}
                >
                  Review Later
                </button>
                <button
                  onClick={() => { setShowActions(false); setNotes(""); }}
                  disabled={resolving}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
