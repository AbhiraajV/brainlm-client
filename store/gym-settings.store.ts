import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WeightUnit } from '@/lib/sessions/types';

const STORAGE_KEY = 'brainlm:gym-settings';
const STORAGE_VERSION = 1;

interface GymSettingsState {
  displayUnit: WeightUnit;
}

interface GymSettingsActions {
  setDisplayUnit(unit: WeightUnit): void;
}

type GymSettingsStore = GymSettingsState & GymSettingsActions;

const initialState: GymSettingsState = {
  displayUnit: 'lbs',
};

// Safe localStorage wrapper
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      console.warn('[GymSettingsStore] Failed to read from localStorage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {
      console.warn('[GymSettingsStore] Failed to write to localStorage');
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      console.warn('[GymSettingsStore] Failed to remove from localStorage');
    }
  },
};

export const useGymSettingsStore = create<GymSettingsStore>()(
  persist(
    (set) => ({
      ...initialState,

      setDisplayUnit: (unit: WeightUnit) => {
        set({ displayUnit: unit });
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        displayUnit: state.displayUnit,
      }),
      migrate: (persistedState: unknown) => {
        if (!persistedState) return initialState;
        try {
          return persistedState as GymSettingsState;
        } catch {
          console.warn('[GymSettingsStore] Failed to migrate, resetting');
          return initialState;
        }
      },
    }
  )
);

// Selectors
export const useDisplayUnit = () => useGymSettingsStore((s) => s.displayUnit);
export const useSetDisplayUnit = () => useGymSettingsStore((s) => s.setDisplayUnit);
