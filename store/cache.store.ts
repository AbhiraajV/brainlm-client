import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CacheState,
  CacheActions,
  CacheStore,
  CachedKnowledge,
  CachedAnalysis,
  CachedGymData,
  ExercisePR,
  TrackerType,
} from '@/lib/sessions/types';

const STORAGE_KEY = 'brainlm:cache';
const STORAGE_VERSION = 1;

const initialState: CacheState = {
  knowledgeCache: {},
  analysisCache: {},
  gymDataCache: null,
};

// Safe localStorage wrapper
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      console.warn('[CacheStore] Failed to read from localStorage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {
      console.warn('[CacheStore] Failed to write to localStorage');
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      console.warn('[CacheStore] Failed to remove from localStorage');
    }
  },
};

export const useCacheStore = create<CacheStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================================================
      // KNOWLEDGE CACHE ACTIONS
      // ========================================================================

      setKnowledgeCache: (trackerType: TrackerType, cache: CachedKnowledge): void => {
        set((state) => ({
          knowledgeCache: {
            ...state.knowledgeCache,
            [trackerType]: cache,
          },
        }));
      },

      updateKnowledgeCache: (trackerType: TrackerType, updates: Partial<CachedKnowledge>): void => {
        set((state) => {
          const existing = state.knowledgeCache[trackerType];
          if (!existing) return state;

          return {
            knowledgeCache: {
              ...state.knowledgeCache,
              [trackerType]: {
                ...existing,
                ...updates,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      clearKnowledgeCache: (trackerType?: TrackerType): void => {
        set((state) => {
          if (trackerType) {
            const { [trackerType]: _, ...rest } = state.knowledgeCache;
            return { knowledgeCache: rest };
          }
          return { knowledgeCache: {} };
        });
      },

      // ========================================================================
      // ANALYSIS CACHE ACTIONS
      // ========================================================================

      setAnalysisCache: (trackerType: TrackerType, cache: CachedAnalysis): void => {
        set((state) => ({
          analysisCache: {
            ...state.analysisCache,
            [trackerType]: cache,
          },
        }));
      },

      updateAnalysisCache: (trackerType: TrackerType, updates: Partial<CachedAnalysis>): void => {
        set((state) => {
          const existing = state.analysisCache[trackerType];
          if (!existing) return state;

          return {
            analysisCache: {
              ...state.analysisCache,
              [trackerType]: {
                ...existing,
                ...updates,
              },
            },
          };
        });
      },

      clearAnalysisCache: (trackerType?: TrackerType): void => {
        set((state) => {
          if (trackerType) {
            const { [trackerType]: _, ...rest } = state.analysisCache;
            return { analysisCache: rest };
          }
          return { analysisCache: {} };
        });
      },

      // ========================================================================
      // GYM DATA CACHE ACTIONS
      // ========================================================================

      setGymDataCache: (cache: CachedGymData): void => {
        set({ gymDataCache: cache });
      },

      updateExercisePR: (exerciseName: string, pr: ExercisePR): void => {
        set((state) => {
          const existing = state.gymDataCache || {
            exercisePRs: {},
            lastEventId: null,
            lastEventAt: null,
            eventCount: 0,
            updatedAt: new Date().toISOString(),
          };

          return {
            gymDataCache: {
              ...existing,
              exercisePRs: {
                ...existing.exercisePRs,
                [exerciseName]: pr,
              },
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      clearGymDataCache: (): void => {
        set({ gymDataCache: null });
      },

      // ========================================================================
      // CLEAR ALL
      // ========================================================================

      clearAllCaches: (): void => {
        set(initialState);
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        knowledgeCache: state.knowledgeCache,
        analysisCache: state.analysisCache,
        gymDataCache: state.gymDataCache,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Handle migration from older versions
        if (!persistedState) {
          return initialState;
        }

        try {
          return persistedState as CacheState;
        } catch {
          console.warn('[CacheStore] Failed to migrate cache data, resetting');
          return initialState;
        }
      },
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectKnowledgeCache = (trackerType: TrackerType) => (state: CacheStore) =>
  state.knowledgeCache[trackerType] || null;

export const selectAnalysisCache = (trackerType: TrackerType) => (state: CacheStore) =>
  state.analysisCache[trackerType] || null;

export const selectGymDataCache = (state: CacheStore) => state.gymDataCache;

export const selectExercisePR = (exerciseName: string) => (state: CacheStore) =>
  state.gymDataCache?.exercisePRs[exerciseName] || null;
