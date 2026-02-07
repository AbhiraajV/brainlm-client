import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { HabitDefinition, HabitPolarity } from '@/lib/sessions/types';

const STORAGE_KEY = 'brainlm:habits';
const STORAGE_VERSION = 1;

interface HabitsState {
  habits: HabitDefinition[];
}

interface HabitsActions {
  addHabit: (name: string, polarity: HabitPolarity) => string;
  updateHabit: (id: string, updates: Partial<Pick<HabitDefinition, 'name' | 'orderIndex'>>) => void;
  archiveHabit: (id: string) => void;
  unarchiveHabit: (id: string) => void;
  deleteHabit: (id: string) => void;
  reorderHabits: (orderedIds: string[]) => void;
}

type HabitsStore = HabitsState & HabitsActions;

const initialState: HabitsState = {
  habits: [],
};

// Safe localStorage wrapper
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      console.warn('[HabitsStore] Failed to read from localStorage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {
      console.warn('[HabitsStore] Failed to write to localStorage');
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      console.warn('[HabitsStore] Failed to remove from localStorage');
    }
  },
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const useHabitsStore = create<HabitsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addHabit: (name: string, polarity: HabitPolarity): string => {
        const id = generateId();
        const now = new Date().toISOString();
        const activeHabits = get().habits.filter((h) => !h.isArchived);

        const newHabit: HabitDefinition = {
          id,
          name,
          polarity,
          orderIndex: activeHabits.length,
          createdAt: now,
          isArchived: false,
        };

        set((state) => ({
          habits: [...state.habits, newHabit],
        }));

        return id;
      },

      updateHabit: (id: string, updates: Partial<Pick<HabitDefinition, 'name' | 'orderIndex'>>): void => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        }));
      },

      archiveHabit: (id: string): void => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, isArchived: true } : h
          ),
        }));
      },

      unarchiveHabit: (id: string): void => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, isArchived: false } : h
          ),
        }));
      },

      deleteHabit: (id: string): void => {
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== id),
        }));
      },

      reorderHabits: (orderedIds: string[]): void => {
        set((state) => ({
          habits: state.habits.map((h) => {
            const idx = orderedIds.indexOf(h.id);
            return idx >= 0 ? { ...h, orderIndex: idx } : h;
          }),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        habits: state.habits,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState) {
          return initialState;
        }
        try {
          return persistedState as HabitsState;
        } catch {
          console.warn('[HabitsStore] Failed to migrate, resetting');
          return initialState;
        }
      },
    }
  )
);

// Selectors
export const selectActiveHabits = (state: HabitsStore) =>
  state.habits.filter((h) => !h.isArchived).sort((a, b) => a.orderIndex - b.orderIndex);

export const selectActivePositive = (state: HabitsStore) =>
  state.habits
    .filter((h) => !h.isArchived && h.polarity === 'positive')
    .sort((a, b) => a.orderIndex - b.orderIndex);

export const selectActiveNegative = (state: HabitsStore) =>
  state.habits
    .filter((h) => !h.isArchived && h.polarity === 'negative')
    .sort((a, b) => a.orderIndex - b.orderIndex);
