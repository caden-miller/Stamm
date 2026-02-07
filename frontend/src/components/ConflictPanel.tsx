import { useState } from "react";
import type { ConflictOut } from "../api/types";
import { resolveConflict } from "../api/client";

interface Props {
  conflicts: ConflictOut[];
  onSelectPerson: (personId: number) => void;
  onConflictResolved: (updatedConflict: ConflictOut) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-red-900/40 border-red-700 text-red-300",
  warning: "bg-amber-900/30 border-amber-700 text-amber-300",
  info: "bg-blue-900/30 border-blue-700 text-blue-300",
};

const SEVERITY_LABELS: Record<string, string> = {
  error: "ERR",
  warning: "WARN",
  info: "INFO",
};

export default function ConflictPanel({
  conflicts,
  onSelectPerson,
  onConflictResolved,
}: Props) {
  if (conflicts.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        No conflicts found. All data looks clean.
      </div>
    );
  }

  const unresolved = conflicts.filter((c) => !c.resolution);
  const resolved = conflicts.filter((c) => c.resolution);

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Conflicts ({unresolved.length} unresolved)
      </h3>

      {unresolved.map((c) => (
        <ConflictCard
          key={c.id}
          conflict={c}
          onSelectPerson={onSelectPerson}
          onConflictResolved={onConflictResolved}
        />
      ))}

      {resolved.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mt-4">
            Resolved ({resolved.length})
          </h3>
          {resolved.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              onSelectPerson={onSelectPerson}
              onConflictResolved={onConflictResolved}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ConflictCard({
  conflict,
  onSelectPerson,
  onConflictResolved,
}: {
  conflict: ConflictOut;
  onSelectPerson: (id: number) => void;
  onConflictResolved: (updatedConflict: ConflictOut) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [notes, setNotes] = useState("");

  const severity = conflict.severity;
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  const label = SEVERITY_LABELS[severity] ?? severity.toUpperCase();
  const isResolved = !!conflict.resolution;

  const handleResolve = async (resolution: string) => {
    setResolving(true);
    try {
      const updated = await resolveConflict(conflict.id, { resolution, notes: notes || undefined });
      onConflictResolved(updated);
      setShowActions(false);
      setNotes("");
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
      alert("Failed to resolve conflict. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className={`px-3 py-2 rounded border text-xs ${style} ${isResolved ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold text-[10px] uppercase">{label}</span>
        <span className="font-medium">
          {conflict.conflict_type.replace(/_/g, " ")}
        </span>
        {isResolved && (
          <span className="ml-auto text-zinc-500 text-[10px]">
            {conflict.resolution}
          </span>
        )}
      </div>
      <div className="text-zinc-400 mb-1">{conflict.description}</div>
      <button
        onClick={() => onSelectPerson(conflict.person_id)}
        className="text-zinc-300 hover:text-white underline underline-offset-2 mb-2"
      >
        {conflict.person_name}
      </button>

      {!isResolved && (
        <div className="mt-2 pt-2 border-t border-zinc-700">
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Resolve Conflict
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolve("confirmed")}
                  disabled={resolving}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white text-[10px] font-medium px-2 py-1 rounded disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleResolve("rejected")}
                  disabled={resolving}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white text-[10px] font-medium px-2 py-1 rounded disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleResolve("needs_review")}
                  disabled={resolving}
                  className="flex-1 bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-medium px-2 py-1 rounded disabled:opacity-50"
                >
                  Review
                </button>
                <button
                  onClick={() => {
                    setShowActions(false);
                    setNotes("");
                  }}
                  disabled={resolving}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white text-[10px] font-medium px-2 py-1 rounded disabled:opacity-50"
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
