import { create } from "zustand";
import {
  fetchPersons,
  fetchEventTypes,
  fetchStats,
  fetchConflicts,
} from "./api/client";
import type {
  PersonSummary,
  EventTypeOut,
  StatsOut,
  ConflictOut,
} from "./api/types";

interface AppState {
  persons: PersonSummary[];
  eventTypes: EventTypeOut[];
  stats: StatsOut | null;
  conflicts: ConflictOut[];
  initialized: boolean;
  loading: boolean;

  initialize: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshConflicts: () => Promise<void>;
  updateConflict: (conflict: ConflictOut) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  persons: [],
  eventTypes: [],
  stats: null,
  conflicts: [],
  initialized: false,
  loading: true,

  initialize: async () => {
    if (get().initialized) return;
    set({ loading: true });
    const [persons, eventTypes, stats, conflicts] = await Promise.all([
      fetchPersons({ limit: 500 }),
      fetchEventTypes(),
      fetchStats(),
      fetchConflicts(),
    ]);
    set({ persons, eventTypes, stats, conflicts, initialized: true, loading: false });
  },

  refreshStats: async () => {
    const stats = await fetchStats();
    set({ stats });
  },

  refreshConflicts: async () => {
    const conflicts = await fetchConflicts();
    set({ conflicts });
  },

  updateConflict: (updated) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === updated.id ? updated : c
      ),
    }));
  },
}));
