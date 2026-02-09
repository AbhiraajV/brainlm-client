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
const STORAGE_VERSION = 2;

// Max analysis cache entries per tracker type prefix (prevents localStorage bloat)
const MAX_ANALYSIS_ENTRIES_PER_TYPE = 5;

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
      // ANALYSIS CACHE ACTIONS (key: trackerType or trackerType:workoutContextKey)
      // ========================================================================

      setAnalysisCache: (cacheKey: string, cache: CachedAnalysis): void => {
        set((state) => {
          const newCache = {
            ...state.analysisCache,
            [cacheKey]: cache,
          };

          // Evict oldest entries if too many for this tracker type prefix
          const prefix = cacheKey.split(':')[0]; // e.g. "gym" from "gym:Push Day:chest,shoulders"
          const prefixKeys = Object.keys(newCache).filter(
            (k) => k === prefix || k.startsWith(prefix + ':')
          );
          if (prefixKeys.length > MAX_ANALYSIS_ENTRIES_PER_TYPE) {
            // Sort by generatedAt ascending (oldest first), evict oldest
            prefixKeys.sort(
              (a, b) => new Date(newCache[a].generatedAt).getTime() - new Date(newCache[b].generatedAt).getTime()
            );
            const toEvict = prefixKeys.slice(0, prefixKeys.length - MAX_ANALYSIS_ENTRIES_PER_TYPE);
            for (const key of toEvict) {
              delete newCache[key];
            }
          }

          return { analysisCache: newCache };
        });
      },

      updateAnalysisCache: (cacheKey: string, updates: Partial<CachedAnalysis>): void => {
        set((state) => {
          const existing = state.analysisCache[cacheKey];
          if (!existing) return state;

          return {
            analysisCache: {
              ...state.analysisCache,
              [cacheKey]: {
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
            // Clear all keys matching this tracker type prefix
            const newCache: Record<string, CachedAnalysis> = {};
            for (const [key, value] of Object.entries(state.analysisCache)) {
              if (key !== trackerType && !key.startsWith(trackerType + ':')) {
                newCache[key] = value;
              }
            }
            return { analysisCache: newCache };
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
        if (!persistedState) {
          return initialState;
        }

        try {
          const state = persistedState as CacheState;
          if (version < 2) {
            // v1 → v2: analysisCache keys were TrackerType, now string.
            // Old keys (e.g. "gym", "diet") are still valid string keys — no transform needed.
            // Just clear analysis cache to avoid stale data with old format.
            return { ...state, analysisCache: {} };
          }
          return state;
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

export const selectAnalysisCache = (cacheKey: string) => (state: CacheStore) =>
  state.analysisCache[cacheKey] || null;

export const selectGymDataCache = (state: CacheStore) => state.gymDataCache;

export const selectExercisePR = (exerciseName: string) => (state: CacheStore) =>
  state.gymDataCache?.exercisePRs[exerciseName] || null;
