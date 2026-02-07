import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchPerson, fetchPhotos } from "../api/client";
import type { PersonDetail, PersonPhotoOut } from "../api/types";
import PhotoGallery from "../components/PhotoGallery";

export default function PersonPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [photos, setPhotos] = useState<PersonPhotoOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    fetchPerson(Number(personId))
      .then(setPerson)
      .finally(() => setLoading(false));
    fetchPhotos(Number(personId)).then(setPhotos).catch(() => {});
  }, [personId]);

  const handlePhotosChange = () => {
    if (personId) fetchPhotos(Number(personId)).then(setPhotos).catch(() => {});
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2" style={{ color: "var(--text-secondary)" }}>
            Person not found
          </div>
          <Link to="/people" className="text-sm" style={{ color: "var(--gold)" }}>
            Back to People
          </Link>
        </div>
      </div>
    );
  }

  const sexLabel = person.sex === "M" ? "Male" : person.sex === "F" ? "Female" : "Unknown";

  return (
    <div className="h-full overflow-y-auto page-enter">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link to="/people" style={{ color: "var(--text-muted)" }} className="hover:underline">
            People
          </Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ color: "var(--text-secondary)" }}>{person.display_name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-6 mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
            style={{
              background: person.sex === "M" ? "rgba(80, 136, 197, 0.15)" : person.sex === "F" ? "rgba(197, 80, 136, 0.15)" : "var(--bg-surface)",
              color: person.sex === "M" ? "#5088c5" : person.sex === "F" ? "#c55088" : "var(--text-muted)",
            }}
          >
            {(person.first_name?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="flex-1">
            <h1
              className="text-3xl font-normal mb-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              {person.display_name}
            </h1>
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span>{sexLabel}</span>
              {person.maiden_name && person.maiden_name !== person.last_name && (
                <span>nee {person.maiden_name}</span>
              )}
              <span>{person.event_count} events</span>
              {person.needs_review && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(200, 163, 78, 0.15)", color: "var(--gold)" }}
                >
                  Needs review
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Events — 2 columns */}
          <div className="lg:col-span-2">
            <Card title={`Events (${person.events.length})`}>
              {person.events.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>No events recorded</div>
              ) : (
                <div className="space-y-2">
                  {person.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-start gap-3 p-3 rounded-lg transition-colors"
                      style={{ background: "var(--bg-surface)" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: evt.event_type.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {evt.event_type.label}
                          </span>
                          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                            {evt.date_raw ?? "No date"}
                          </span>
                        </div>
                        {evt.location && (
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {evt.location.name}
                          </div>
                        )}
                        {evt.validation_status === "conflict" && (
                          <div className="text-xs mt-0.5" style={{ color: "#e07070" }}>
                            Conflict detected
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar — 1 column */}
          <div className="space-y-6">
            {/* Family */}
            {person.families.length > 0 && (
              <Card title="Family">
                <div className="space-y-3">
                  {person.families.map((fam) => (
                    <div
                      key={fam.id}
                      className="p-3 rounded-lg text-sm"
                      style={{ background: "var(--bg-surface)" }}
                    >
                      {fam.role === "spouse" ? (
                        <>
                          <div className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                            Spouse: {fam.spouse_name ?? "Unknown"}
                          </div>
                          {fam.children.length > 0 && (
                            <div style={{ color: "var(--text-secondary)" }}>
                              Children: {fam.children.join(", ")}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                            Parents: {fam.spouse_name ?? "Unknown"}
                          </div>
                          {fam.children.length > 0 && (
                            <div style={{ color: "var(--text-secondary)" }}>
                              Siblings: {fam.children.join(", ")}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Quick links */}
            <Card title="Actions">
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/ancestry?person=${person.id}`)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg transition-colors"
                  style={{ color: "var(--gold)", background: "rgba(200, 163, 78, 0.08)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200, 163, 78, 0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(200, 163, 78, 0.08)")}
                >
                  Find relationships
                </button>
              </div>
            </Card>

            {/* Photos */}
            <Card title="Photos">
              <PhotoGallery
                personId={person.id}
                photos={photos}
                onPhotosChange={handlePhotosChange}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <h3
        className="text-base font-semibold mb-4"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
