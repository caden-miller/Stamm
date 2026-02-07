import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store";
import type {
  OriginsData,
  TimelineHistogram,
  EventsByType,
  GenderDistribution,
  LifespanData,
} from "../api/types";
import {
  fetchOrigins,
  fetchTimelineHistogram,
  fetchEventsByType,
  fetchGenderDistribution,
  fetchLifespan,
} from "../api/client";

export default function DashboardPage() {
  const stats = useAppStore((s) => s.stats);
  const conflicts = useAppStore((s) => s.conflicts);
  const unresolvedCount = conflicts.filter((c) => !c.resolution).length;

  const [origins, setOrigins] = useState<OriginsData | null>(null);
  const [histogram, setHistogram] = useState<TimelineHistogram | null>(null);
  const [eventsByType, setEventsByType] = useState<EventsByType | null>(null);
  const [gender, setGender] = useState<GenderDistribution | null>(null);
  const [lifespan, setLifespan] = useState<LifespanData | null>(null);

  useEffect(() => {
    fetchOrigins().then(setOrigins);
    fetchTimelineHistogram("decade").then(setHistogram);
    fetchEventsByType().then(setEventsByType);
    fetchGenderDistribution().then(setGender);
    fetchLifespan().then(setLifespan);
  }, []);

  return (
    <div className="h-full overflow-y-auto page-enter">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-10">
          <h1
            className="text-4xl font-normal mb-2"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            Your Family History
          </h1>
          <p className="text-base" style={{ color: "var(--text-secondary)" }}>
            Explore generations of stories, events, and connections.
          </p>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-10">
            <StatCard label="People" value={stats.persons} />
            <StatCard label="Families" value={stats.families} />
            <StatCard label="Events" value={stats.events} />
            <StatCard label="Locations" value={stats.locations} />
            <StatCard label="Geocoded" value={`${stats.locations_geocoded}/${stats.locations}`} />
            <StatCard
              label="Conflicts"
              value={unresolvedCount}
              accent={unresolvedCount > 0}
            />
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <ActionCard
            to="/explore"
            title="Map Explorer"
            description="View events on an interactive map with timeline playback"
            icon="🗺️"
          />
          <ActionCard
            to="/people"
            title="People Directory"
            description="Browse, search, and explore your entire family tree"
            icon="👤"
          />
          <ActionCard
            to="/ancestry"
            title="Find Relationships"
            description="Discover how any two people in your tree are connected"
            icon="🔗"
          />
        </div>

        {/* Analytics grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lifespan */}
          {lifespan && lifespan.average_lifespan !== null && (
            <Card title="Lifespan Statistics">
              <div className="grid grid-cols-2 gap-4">
                <MiniStat label="Average" value={`${lifespan.average_lifespan.toFixed(1)} yrs`} />
                <MiniStat label="Median" value={`${lifespan.median_lifespan} yrs`} />
                <MiniStat label="Range" value={`${lifespan.min_lifespan}–${lifespan.max_lifespan} yrs`} />
                <MiniStat label="Sample Size" value={`${lifespan.person_count} people`} />
              </div>
            </Card>
          )}

          {/* Gender */}
          {gender && (
            <Card title="Demographics">
              <div className="space-y-3">
                {gender.distribution.map((item) => {
                  const pct = ((item.count / gender.total_persons) * 100).toFixed(1);
                  return (
                    <div key={item.sex}>
                      <div className="flex justify-between text-sm mb-1">
                        <span style={{ color: "var(--text-primary)" }}>{item.sex || "Unknown"}</span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: "var(--bg-surface)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: item.sex === "M" ? "#5088c5" : item.sex === "F" ? "#c55088" : "var(--text-muted)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Events by Type */}
          {eventsByType && (
            <Card title="Events by Type">
              <div className="space-y-2.5">
                {eventsByType.event_types.slice(0, 8).map((item) => (
                  <div key={item.code} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Timeline histogram */}
          {histogram && (
            <Card title="Events Over Time">
              <div className="space-y-1.5">
                {histogram.histogram.map((bucket) => {
                  const maxCount = Math.max(...histogram.histogram.map((b) => b.count));
                  return (
                    <div key={bucket.period} className="flex items-center gap-3">
                      <span
                        className="text-xs w-12 text-right tabular-nums shrink-0"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {bucket.period}
                      </span>
                      <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                        <div
                          className="h-full rounded-sm transition-all duration-700"
                          style={{
                            width: `${(bucket.count / maxCount) * 100}%`,
                            background: "var(--gold-dim)",
                          }}
                        />
                      </div>
                      <span
                        className="text-xs w-10 text-right tabular-nums shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {bucket.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Origins */}
          {origins && origins.birth_countries.length > 0 && (
            <Card title="Birth Countries">
              <div className="space-y-2">
                {origins.birth_countries.slice(0, 8).map((item) => (
                  <div key={item.country} className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{item.country}</span>
                    <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        background: accent ? "rgba(197, 80, 80, 0.08)" : "var(--bg-card)",
        borderColor: accent ? "rgba(197, 80, 80, 0.25)" : "var(--border)",
      }}
    >
      <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-xl font-semibold tabular-nums"
        style={{ color: accent ? "#e07070" : "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function ActionCard({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-xl border p-5 transition-all duration-200 group"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-card-hover)";
        e.currentTarget.style.borderColor = "var(--gold-dim)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-card)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div className="text-2xl mb-3">{icon}</div>
      <h3
        className="text-base font-semibold mb-1 group-hover:text-[var(--gold)] transition-colors"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    </Link>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
