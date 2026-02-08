import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ExerciseLibraryEntry } from '@/lib/sessions/types';

const STORAGE_KEY = 'brainlm:exercise-library';
const STORAGE_VERSION = 1;

interface ExerciseLibraryCacheState {
  entries: ExerciseLibraryEntry[];
  fetchedAt: string | null;
}

interface ExerciseLibraryCacheActions {
  setLibrary(entries: ExerciseLibraryEntry[], fetchedAt: string): void;
  clearLibrary(): void;
}

type ExerciseLibraryStore = ExerciseLibraryCacheState & ExerciseLibraryCacheActions;

const initialState: ExerciseLibraryCacheState = {
  entries: [],
  fetchedAt: null,
};

// Safe localStorage wrapper
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      console.warn('[ExerciseLibraryStore] Failed to read from localStorage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {
      console.warn('[ExerciseLibraryStore] Failed to write to localStorage');
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      console.warn('[ExerciseLibraryStore] Failed to remove from localStorage');
    }
  },
};

export const useExerciseLibraryStore = create<ExerciseLibraryStore>()(
  persist(
    (set) => ({
      ...initialState,

      setLibrary: (entries: ExerciseLibraryEntry[], fetchedAt: string) => {
        set({ entries, fetchedAt });
      },

      clearLibrary: () => {
        set(initialState);
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        entries: state.entries,
        fetchedAt: state.fetchedAt,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState) return initialState;
        try {
          return persistedState as ExerciseLibraryCacheState;
        } catch {
          console.warn('[ExerciseLibraryStore] Failed to migrate, resetting');
          return initialState;
        }
      },
    }
  )
);
