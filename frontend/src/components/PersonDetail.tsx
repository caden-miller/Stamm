import type { PersonDetail as PersonDetailType } from "../api/types";

interface Props {
  person: PersonDetailType | null;
  loading: boolean;
  onClose: () => void;
  onSelectEvent: (eventId: number) => void;
}

export default function PersonDetail({
  person,
  loading,
  onClose,
  onSelectEvent,
}: Props) {
  if (loading) {
    return (
      <div className="p-4 text-zinc-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!person) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        Select a person or event to view details.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-100">
            {person.display_name}
          </h2>
          <div className="text-xs text-zinc-500 mt-0.5">
            {person.sex === "M" ? "Male" : person.sex === "F" ? "Female" : "Unknown"}
            {person.maiden_name &&
              person.maiden_name !== person.last_name &&
              ` · née ${person.maiden_name}`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Events */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Events
        </h3>
        <div className="space-y-1.5">
          {person.events.map((evt) => (
            <button
              key={evt.id}
              onClick={() => onSelectEvent(evt.id)}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-zinc-800 transition group"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: evt.event_type.color }}
                />
                <span className="text-xs font-medium text-zinc-200">
                  {evt.event_type.label}
                </span>
                <span className="text-xs text-zinc-500 ml-auto">
                  {evt.date_raw ?? "No date"}
                </span>
              </div>
              {evt.location && (
                <div className="text-xs text-zinc-500 ml-4 mt-0.5">
                  {evt.location.name}
                </div>
              )}
              {evt.validation_status === "conflict" && (
                <div className="text-xs text-amber-400 ml-4 mt-0.5">
                  ⚠ Conflict detected
                </div>
              )}
            </button>
          ))}
          {person.events.length === 0 && (
            <div className="text-xs text-zinc-600 px-2.5">No events</div>
          )}
        </div>
      </div>

      {/* Families */}
      {person.families.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Family
          </h3>
          <div className="space-y-2">
            {person.families.map((fam) => (
              <div
                key={fam.id}
                className="px-2.5 py-1.5 rounded bg-zinc-800/50 text-xs"
              >
                {fam.role === "spouse" ? (
                  <>
                    <div className="text-zinc-300">
                      Spouse: {fam.spouse_name ?? "Unknown"}
                    </div>
                    {fam.children.length > 0 && (
                      <div className="text-zinc-500 mt-0.5">
                        Children: {fam.children.join(", ")}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-zinc-300">
                      Parents: {fam.spouse_name ?? "Unknown"}
                    </div>
                    {fam.children.length > 0 && (
                      <div className="text-zinc-500 mt-0.5">
                        Siblings: {fam.children.join(", ")}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
