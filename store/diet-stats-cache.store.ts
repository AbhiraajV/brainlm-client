import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DietStatDay } from '@/server/actions/diet-stats.actions';

const STORAGE_KEY = 'brainlm:diet-stats-cache';
const STORAGE_VERSION = 2;

interface DietStatsCacheState {
  days: DietStatDay[];
  lastFetchedAt: string | null; // ISO timestamp of last fetch
}

interface DietStatsCacheActions {
  setDays: (days: DietStatDay[]) => void;
  appendDelta: (newDays: DietStatDay[]) => void;
  clear: () => void;
  forceRefresh: () => void;
}

export type DietStatsCacheStore = DietStatsCacheState & DietStatsCacheActions;

const initialState: DietStatsCacheState = {
  days: [],
  lastFetchedAt: null,
};

const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {}
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {}
  },
};

export const useDietStatsCacheStore = create<DietStatsCacheStore>()(
  persist(
    (set) => ({
      ...initialState,

      setDays: (days) => {
        set({
          days,
          lastFetchedAt: new Date().toISOString(),
        });
      },

      appendDelta: (newDays) => {
        set((state) => {
          // Merge by date — new days override existing for same date
          const map = new Map<string, DietStatDay>();
          for (const d of state.days) map.set(d.date, d);
          for (const d of newDays) map.set(d.date, d);
          const merged = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
          return {
            days: merged,
            lastFetchedAt: new Date().toISOString(),
          };
        });
      },

      clear: () => set(initialState),

      forceRefresh: () => set({ days: [], lastFetchedAt: null }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        days: state.days,
        lastFetchedAt: state.lastFetchedAt,
      }),
      migrate: () => initialState,
    }
  )
);
