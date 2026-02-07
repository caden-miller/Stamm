# Implementation Plan for Issue #1: Ancestor Path Viewer + Dashboard & UI Overhaul

## Status: Backend Complete ✓ | Frontend In Progress

## Completed Work

### Backend APIs (All Complete)

1. **Ancestry Path Finding** - `api/routes/ancestry.py`
   - ✓ GET `/api/ancestry/persons/{id}/ancestors?generations=N`
   - ✓ GET `/api/ancestry/persons/{id}/descendants?generations=N`
   - ✓ GET `/api/ancestry/persons/{id1}/path/{id2}`

2. **Person Profiles** - `db/models.py`, `api/routes/persons.py`
   - ✓ Added `profile_image` and `biography` columns to Person model
   - ✓ PATCH `/api/persons/{id}` for profile updates
   - ✓ Extended PersonDetail schema

3. **GEDCOM Upload** - `api/routes/upload.py`
   - ✓ POST `/api/upload/gedcom` with file validation and processing

4. **Analytics** - `api/routes/analytics.py`
   - ✓ GET `/api/analytics/origins` - Ancestral origins by location
   - ✓ GET `/api/analytics/locations/top` - Most common cities
   - ✓ GET `/api/analytics/timeline/histogram` - Events by decade/century
   - ✓ GET `/api/analytics/timeline/events-by-type` - Event distribution
   - ✓ GET `/api/analytics/families/size-distribution` - Family sizes
   - ✓ GET `/api/analytics/demographics/gender` - Gender distribution
   - ✓ GET `/api/analytics/lifespan/average` - Lifespan statistics

### Frontend Setup

- ✓ Installed react-router-dom@6
- ✓ Installed recharts (for charts)
- ✓ Installed zustand (for state management)
- ✓ Configured TypeScript path aliases (@/*)
- ✓ Updated vite.config.ts with path resolution

---

## Remaining Frontend Work

### Phase 1: API Client & Types

**File: `frontend/src/api/types.ts`**

Add new TypeScript interfaces:

```typescript
// Ancestry types
export interface AncestorNode {
  id: number;
  gedcom_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  sex: string | null;
  generation: number;
  parents: AncestorNode[];
}

export interface AncestorTreeResponse {
  root_person_id: number;
  root_person_name: string;
  generations: number;
  ancestors: AncestorNode[];
}

export interface PathNode {
  id: number;
  gedcom_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  sex: string | null;
  relationship_to_next: string | null;
}

export interface RelationshipPath {
  person1_id: number;
  person1_name: string;
  person2_id: number;
  person2_name: string;
  path_found: boolean;
  path_length?: number;
  path: PathNode[];
  relationship_description: string;
}

// Analytics types
export interface OriginData {
  country: string;
  count: number;
}

export interface StateOriginData {
  state: string;
  country: string;
  count: number;
}

export interface OriginsResponse {
  birth_countries: OriginData[];
  birth_states: StateOriginData[];
  death_countries: OriginData[];
  death_states: StateOriginData[];
}

export interface HistogramBucket {
  period: string;
  count: number;
}

export interface TimelineHistogram {
  bucket_size: string;
  histogram: HistogramBucket[];
}

// Update PersonDetail to include new fields
export interface PersonDetailT {
  // ... existing fields ...
  profile_image?: string | null;
  biography?: string | null;
}

export interface PersonProfileUpdate {
  profile_image?: string;
  biography?: string;
  notes?: string;
}
```

**File: `frontend/src/api/client.ts`**

Add new API functions:

```typescript
// Ancestry APIs
export async function getAncestors(
  personId: number,
  generations: number = 3
): Promise<AncestorTreeResponse> {
  return fetchAPI(`/ancestry/persons/${personId}/ancestors?generations=${generations}`);
}

export async function getRelationshipPath(
  person1Id: number,
  person2Id: number
): Promise<RelationshipPath> {
  return fetchAPI(`/ancestry/persons/${person1Id}/path/${person2Id}`);
}

// Analytics APIs
export async function getOrigins(): Promise<OriginsResponse> {
  return fetchAPI('/analytics/origins');
}

export async function getTimelineHistogram(
  bucketSize: 'decade' | 'century' = 'decade'
): Promise<TimelineHistogram> {
  return fetchAPI(`/analytics/timeline/histogram?bucket_size=${bucketSize}`);
}

// Upload API
export async function uploadGedcom(file: File): Promise<{
  status: string;
  message: string;
  persons_loaded: number;
  families_loaded: number;
  conflicts_found: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload/gedcom', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Upload failed');
  }

  return response.json();
}

// Person Profile Update
export async function updatePersonProfile(
  personId: number,
  updates: PersonProfileUpdate
): Promise<PersonDetailT> {
  const response = await fetch(`/api/persons/${personId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update profile');
  }

  return response.json();
}
```

### Phase 2: Zustand State Store

**File: `frontend/src/store/useStore.ts`**

Create centralized state management:

```typescript
import { create } from 'zustand';
import type { EventTypeOut, PersonSummary, StatsOut } from '@/api/types';

interface AppState {
  // Core data
  eventTypes: EventTypeOut[];
  persons: PersonSummary[];
  stats: StatsOut | null;

  // Filters
  activeTypes: string[];
  searchQuery: string;

  // Actions
  setEventTypes: (types: EventTypeOut[]) => void;
  setPersons: (persons: PersonSummary[]) => void;
  setStats: (stats: StatsOut) => void;
  toggleEventType: (code: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useStore = create<AppState>((set) => ({
  eventTypes: [],
  persons: [],
  stats: null,
  activeTypes: [],
  searchQuery: '',

  setEventTypes: (types) => set({ eventTypes: types, activeTypes: types.map(t => t.code) }),
  setPersons: (persons) => set({ persons }),
  setStats: (stats) => set({ stats }),
  toggleEventType: (code) => set((state) => ({
    activeTypes: state.activeTypes.includes(code)
      ? state.activeTypes.filter(c => c !== code)
      : [...state.activeTypes, code]
  })),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
```

### Phase 3: React Router Setup

**File: `frontend/src/main.tsx`**

Wrap app with BrowserRouter:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

**File: `frontend/src/App.tsx`**

Convert to router-based layout:

```typescript
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TimelapseView from './pages/TimelapseView';
import AncestorPathView from './pages/AncestorPathView';
import AnalyticsView from './pages/AnalyticsView';
import UploadView from './pages/UploadView';
import ConflictsView from './pages/ConflictsView';

function App() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/timelapse" element={<TimelapseView />} />
        <Route path="/ancestry" element={<AncestorPathView />} />
        <Route path="/analytics" element={<AnalyticsView />} />
        <Route path="/upload" element={<UploadView />} />
        <Route path="/conflicts" element={<ConflictsView />} />
      </Routes>
    </div>
  );
}

export default App;
```

### Phase 4: Dashboard Page

**File: `frontend/src/pages/Dashboard.tsx`**

Create main landing page with navigation cards:

```typescript
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getStats } from '@/api/client';
import type { StatsOut } from '@/api/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsOut | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  const cards = [
    {
      title: 'Timelapse Viewer',
      description: 'Explore your family history through time',
      icon: '⏱️',
      path: '/timelapse',
    },
    {
      title: 'Ancestor Path',
      description: 'Find relationships between any two people',
      icon: '🌳',
      path: '/ancestry',
    },
    {
      title: 'Analytics',
      description: 'Insights and statistics about your family tree',
      icon: '📊',
      path: '/analytics',
    },
    {
      title: 'Upload GEDCOM',
      description: 'Import a new GEDCOM file',
      icon: '📤',
      path: '/upload',
    },
    {
      title: 'Conflicts',
      description: 'Review and resolve data conflicts',
      icon: '⚠️',
      path: '/conflicts',
      badge: stats?.conflicts_unresolved || 0,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Ancestry Viewer</h1>
        <p className="text-zinc-400 text-lg">
          Explore and visualize your family history
        </p>
        {stats && (
          <div className="mt-6 flex justify-center gap-8 text-sm">
            <div>
              <span className="text-zinc-400">Persons:</span>{' '}
              <span className="font-semibold">{stats.persons}</span>
            </div>
            <div>
              <span className="text-zinc-400">Events:</span>{' '}
              <span className="font-semibold">{stats.events}</span>
            </div>
            <div>
              <span className="text-zinc-400">Locations:</span>{' '}
              <span className="font-semibold">{stats.locations}</span>
            </div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="relative p-6 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-left"
          >
            {card.badge !== undefined && card.badge > 0 && (
              <span className="absolute top-4 right-4 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {card.badge}
              </span>
            )}
            <div className="text-4xl mb-4">{card.icon}</div>
            <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
            <p className="text-zinc-400">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Phase 5: Ancestor Path Viewer

**File: `frontend/src/pages/AncestorPathView.tsx`**

Build the relationship path finder:

```typescript
import { useState } from 'react';
import { getRelationshipPath } from '@/api/client';
import { useStore } from '@/store/useStore';
import type { RelationshipPath } from '@/api/types';

export default function AncestorPathView() {
  const persons = useStore((state) => state.persons);
  const [person1Id, setPerson1Id] = useState<number | null>(null);
  const [person2Id, setPerson2Id] = useState<number | null>(null);
  const [path, setPath] = useState<RelationshipPath | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFindPath = async () => {
    if (!person1Id || !person2Id) return;

    setLoading(true);
    try {
      const result = await getRelationshipPath(person1Id, person2Id);
      setPath(result);
    } catch (error) {
      console.error('Failed to find path:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Ancestor Path Finder</h1>

      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Person 1</label>
            <select
              className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2"
              value={person1Id || ''}
              onChange={(e) => setPerson1Id(Number(e.target.value))}
            >
              <option value="">Select person...</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Person 2</label>
            <select
              className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2"
              value={person2Id || ''}
              onChange={(e) => setPerson2Id(Number(e.target.value))}
            >
              <option value="">Select person...</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleFindPath}
          disabled={!person1Id || !person2Id || loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 px-6 py-2 rounded"
        >
          {loading ? 'Finding path...' : 'Find Relationship'}
        </button>
      </div>

      {path && (
        <div className="bg-zinc-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">
            {path.relationship_description}
          </h2>

          {path.path_found ? (
            <div className="space-y-4">
              {path.path.map((node, index) => (
                <div key={node.id} className="flex items-center gap-4">
                  <div className="flex-1 bg-zinc-700 p-4 rounded">
                    <div className="font-semibold">{node.display_name}</div>
                    <div className="text-sm text-zinc-400">
                      {node.first_name} {node.last_name}
                    </div>
                  </div>

                  {node.relationship_to_next && (
                    <div className="text-zinc-400">
                      → {node.relationship_to_next}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-400">No relationship path found.</p>
          )}
        </div>
      )}
    </div>
  );
}
```

### Phase 6: Analytics View with Recharts

**File: `frontend/src/pages/AnalyticsView.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getOrigins, getTimelineHistogram } from '@/api/client';
import type { OriginsResponse, TimelineHistogram } from '@/api/types';

export default function AnalyticsView() {
  const [origins, setOrigins] = useState<OriginsResponse | null>(null);
  const [histogram, setHistogram] = useState<TimelineHistogram | null>(null);

  useEffect(() => {
    getOrigins().then(setOrigins);
    getTimelineHistogram('decade').then(setHistogram);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Family Analytics</h1>

      {/* Timeline Histogram */}
      {histogram && (
        <div className="bg-zinc-800 p-6 rounded-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4">Events Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={histogram.histogram}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Birth Countries */}
      {origins && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Birth Locations</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={origins.birth_countries.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="country" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Death Locations</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={origins.death_countries.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="country" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Phase 7: Upload View

**File: `frontend/src/pages/UploadView.tsx`**

```typescript
import { useState, useRef } from 'react';
import { uploadGedcom } from '@/api/client';

export default function UploadView() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const res = await uploadGedcom(file);
      setResult(res);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Upload GEDCOM File</h1>

      <div className="bg-zinc-800 p-6 rounded-lg">
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Select GEDCOM File (.ged or .gedcom)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ged,.gedcom"
            onChange={handleFileChange}
            className="w-full"
          />
        </div>

        {file && (
          <div className="mb-4 text-sm text-zinc-400">
            Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 px-6 py-2 rounded"
        >
          {uploading ? 'Uploading...' : 'Upload and Process'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-500/20 border border-green-500 rounded">
            <h3 className="font-semibold mb-2">Upload Successful!</h3>
            <ul className="text-sm space-y-1">
              <li>Persons loaded: {result.persons_loaded}</li>
              <li>Families loaded: {result.families_loaded}</li>
              <li>Conflicts found: {result.conflicts_found}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Backend APIs respond correctly
- [ ] Dashboard navigation works
- [ ] Ancestor path finder correctly identifies relationships
- [ ] Analytics charts render properly
- [ ] GEDCOM upload processes files
- [ ] Person profile updates save
- [ ] No regressions in existing timelapse/map functionality
- [ ] All routes are accessible
- [ ] Error handling works (network failures, invalid inputs)

---

## Notes

- shadcn/ui setup encountered issues with Tailwind v4 - proceed with custom Tailwind components
- Database schema changes require manual migration (no Alembic configured)
- Test with existing GEDCOM data before uploading new files
- Consider adding loading states and error boundaries for production
