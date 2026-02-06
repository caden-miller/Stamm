import type { PersonSummary } from "../api/types";

interface Props {
  persons: PersonSummary[];
  selectedPersonId: number | null;
  onSelectPerson: (id: number) => void;
}

export default function PersonList({
  persons,
  selectedPersonId,
  onSelectPerson,
}: Props) {
  return (
    <div className="overflow-y-auto h-full">
      {persons.map((p) => {
        const isSelected = p.id === selectedPersonId;
        return (
          <button
            key={p.id}
            onClick={() => onSelectPerson(p.id)}
            className={`w-full text-left px-3 py-2 border-b border-zinc-800 transition
              ${isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-200 font-medium">
                {p.display_name}
              </span>
              <span className="text-xs text-zinc-600">
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
              {p.conflict_count > 0 && (
                <span className="text-xs text-red-400">
                  {p.conflict_count} conflict{p.conflict_count > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </button>
        );
      })}
      {persons.length === 0 && (
        <div className="p-4 text-zinc-600 text-sm text-center">
          No persons found
        </div>
      )}
    </div>
  );
}
