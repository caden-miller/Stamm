import { useEffect, useState } from "react";
import type {
  OriginsData,
  TopLocationsData,
  TimelineHistogram,
  EventsByType,
  FamilySizeDistribution,
  GenderDistribution,
  LifespanData,
  StatsOut,
} from "../api/types";
import {
  fetchOrigins,
  fetchTopLocations,
  fetchTimelineHistogram,
  fetchEventsByType,
  fetchFamilySizeDistribution,
  fetchGenderDistribution,
  fetchLifespan,
} from "../api/client";

interface Props {
  stats: StatsOut | null;
}

export default function Dashboard({ stats }: Props) {
  const [origins, setOrigins] = useState<OriginsData | null>(null);
  const [topLocations, setTopLocations] = useState<TopLocationsData | null>(null);
  const [histogram, setHistogram] = useState<TimelineHistogram | null>(null);
  const [eventsByType, setEventsByType] = useState<EventsByType | null>(null);
  const [familySize, setFamilySize] = useState<FamilySizeDistribution | null>(null);
  const [gender, setGender] = useState<GenderDistribution | null>(null);
  const [lifespan, setLifespan] = useState<LifespanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchOrigins(),
      fetchTopLocations(10),
      fetchTimelineHistogram("decade"),
      fetchEventsByType(),
      fetchFamilySizeDistribution(),
      fetchGenderDistribution(),
      fetchLifespan(),
    ])
      .then(([o, tl, h, ebt, fs, g, ls]) => {
        setOrigins(o);
        setTopLocations(tl);
        setHistogram(h);
        setEventsByType(ebt);
        setFamilySize(fs);
        setGender(g);
        setLifespan(ls);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-zinc-400 text-sm">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">Analytics Dashboard</h2>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Persons" value={stats.persons} />
          <StatCard label="Total Families" value={stats.families} />
          <StatCard label="Total Events" value={stats.events} />
          <StatCard label="Total Locations" value={stats.locations} />
          <StatCard
            label="Geocoded Locations"
            value={`${stats.locations_geocoded}/${stats.locations}`}
          />
          <StatCard
            label="Unresolved Conflicts"
            value={stats.conflicts_unresolved}
            highlight={stats.conflicts_unresolved > 0}
          />
        </div>
      )}

      {/* Lifespan Stats */}
      {lifespan && lifespan.average_lifespan !== null && (
        <Section title="Average Lifespan">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm">
              <span className="text-zinc-400">Average: </span>
              <span className="text-zinc-100 font-medium">
                {lifespan.average_lifespan.toFixed(1)} years
              </span>
            </div>
            <div className="text-sm">
              <span className="text-zinc-400">Median: </span>
              <span className="text-zinc-100 font-medium">
                {lifespan.median_lifespan} years
              </span>
            </div>
            <div className="text-sm">
              <span className="text-zinc-400">Range: </span>
              <span className="text-zinc-100 font-medium">
                {lifespan.min_lifespan} - {lifespan.max_lifespan} years
              </span>
            </div>
            <div className="text-sm">
              <span className="text-zinc-400">Sample: </span>
              <span className="text-zinc-100 font-medium">
                {lifespan.person_count} persons
              </span>
            </div>
          </div>
        </Section>
      )}

      {/* Gender Distribution */}
      {gender && (
        <Section title="Gender Distribution">
          <div className="space-y-2">
            {gender.distribution.map((item) => (
              <div key={item.sex} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{item.sex}</span>
                <span className="text-zinc-400">
                  {item.count} ({((item.count / gender.total_persons) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Events by Type */}
      {eventsByType && (
        <Section title="Events by Type">
          <div className="space-y-2">
            {eventsByType.event_types.slice(0, 10).map((item) => (
              <div key={item.code} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-zinc-300">{item.label}</span>
                </div>
                <span className="text-zinc-400">{item.count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Timeline Histogram */}
      {histogram && (
        <Section title="Events Over Time">
          <div className="space-y-1">
            {histogram.histogram.map((bucket) => (
              <div key={bucket.period} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-300 w-16">{bucket.period}</span>
                <div className="flex-1 bg-zinc-800 rounded-sm h-5 relative overflow-hidden">
                  <div
                    className="bg-blue-600 h-full"
                    style={{
                      width: `${(bucket.count / Math.max(...histogram.histogram.map((b) => b.count))) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-zinc-400 w-12 text-right">{bucket.count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Family Size Distribution */}
      {familySize && (
        <Section title="Family Size Distribution">
          <div className="text-sm mb-2">
            <span className="text-zinc-400">Average children per family: </span>
            <span className="text-zinc-100 font-medium">
              {familySize.avg_children.toFixed(1)}
            </span>
          </div>
          <div className="space-y-1">
            {familySize.distribution.slice(0, 10).map((item) => (
              <div key={item.children} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">
                  {item.children} {item.children === 1 ? "child" : "children"}
                </span>
                <span className="text-zinc-400">
                  {item.families} {item.families === 1 ? "family" : "families"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Top Birth Locations */}
      {origins && origins.birth_countries.length > 0 && (
        <Section title="Top Birth Countries">
          <div className="space-y-2">
            {origins.birth_countries.slice(0, 10).map((item) => (
              <div key={item.country} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{item.country}</span>
                <span className="text-zinc-400">{item.count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Top Death Locations */}
      {origins && origins.death_countries.length > 0 && (
        <Section title="Top Death Countries">
          <div className="space-y-2">
            {origins.death_countries.slice(0, 10).map((item) => (
              <div key={item.country} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{item.country}</span>
                <span className="text-zinc-400">{item.count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Top Cities */}
      {topLocations && topLocations.top_cities.length > 0 && (
        <Section title="Most Common Cities">
          <div className="space-y-2">
            {topLocations.top_cities.map((item) => (
              <div
                key={`${item.city}-${item.state}-${item.country}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-zinc-300">
                  {item.city}, {item.state || item.country}
                </span>
                <span className="text-zinc-400">{item.event_count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded border ${
        highlight
          ? "bg-amber-900/20 border-amber-700"
          : "bg-zinc-800 border-zinc-700"
      }`}
    >
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div
        className={`text-lg font-semibold ${
          highlight ? "text-amber-300" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded p-3">
      <h3 className="text-sm font-semibold text-zinc-200 mb-2">{title}</h3>
      {children}
    </div>
  );
}
