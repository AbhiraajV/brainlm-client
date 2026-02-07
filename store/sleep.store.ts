import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_KEY = 'brainlm:sleep';
const STORAGE_VERSION = 1;

interface SleepState {
  enabled: boolean;
  lastMorningPromptDate: string | null; // "YYYY-MM-DD"
  lastBedtimeEventDate: string | null;  // ISO string
}

interface SleepActions {
  setEnabled: (enabled: boolean) => void;
  markMorningPromptShown: () => void;
  markBedtimeEventRecorded: () => void;
  shouldShowMorningPrompt: () => boolean;
  shouldShowBedtimeButton: () => boolean;
}

type SleepStore = SleepState & SleepActions;

const initialState: SleepState = {
  enabled: false,
  lastMorningPromptDate: null,
  lastBedtimeEventDate: null,
};

// Safe localStorage wrapper
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      console.warn('[SleepStore] Failed to read from localStorage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {
      console.warn('[SleepStore] Failed to write to localStorage');
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      console.warn('[SleepStore] Failed to remove from localStorage');
    }
  },
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the "evening window" date key.
 * Evening window: 7pm on day N → 3:59am on day N+1 all map to day N.
 * This prevents the button reappearing after midnight for the same evening.
 */
function eveningWindowKey(): string {
  const now = new Date();
  const hour = now.getHours();
  // If 0-3 (after midnight), the evening belongs to yesterday
  if (hour < 4) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

export const useSleepStore = create<SleepStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setEnabled: (enabled: boolean) => set({ enabled }),

      markMorningPromptShown: () =>
        set({ lastMorningPromptDate: todayStr() }),

      markBedtimeEventRecorded: () =>
        set({ lastBedtimeEventDate: eveningWindowKey() }),

      shouldShowMorningPrompt: (): boolean => {
        const { enabled, lastMorningPromptDate } = get();
        if (!enabled) return false;
        const hour = new Date().getHours();
        if (hour < 4 || hour >= 14) return false; // 4am–2pm only
        return lastMorningPromptDate !== todayStr();
      },

      shouldShowBedtimeButton: (): boolean => {
        const { enabled, lastBedtimeEventDate } = get();
        if (!enabled) return false;
        const hour = new Date().getHours();
        // Visible 7pm–11:59pm or 12am–3:59am
        if (hour >= 4 && hour < 19) return false;
        return lastBedtimeEventDate !== eveningWindowKey();
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        lastMorningPromptDate: state.lastMorningPromptDate,
        lastBedtimeEventDate: state.lastBedtimeEventDate,
      }),
      migrate: (persistedState: unknown) => {
        if (!persistedState) return initialState;
        try {
          return persistedState as SleepState;
        } catch {
          console.warn('[SleepStore] Failed to migrate, resetting');
          return initialState;
        }
      },
    }
  )
);
