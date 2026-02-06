import type { ConflictOut } from "../api/types";

interface Props {
  conflicts: ConflictOut[];
  onSelectPerson: (personId: number) => void;
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
        <ConflictCard key={c.id} conflict={c} onSelectPerson={onSelectPerson} />
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
}: {
  conflict: ConflictOut;
  onSelectPerson: (id: number) => void;
}) {
  const severity = conflict.severity;
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  const label = SEVERITY_LABELS[severity] ?? severity.toUpperCase();
  const isResolved = !!conflict.resolution;

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
        className="text-zinc-300 hover:text-white underline underline-offset-2"
      >
        {conflict.person_name}
      </button>
    </div>
  );
}
