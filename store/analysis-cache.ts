import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AnalysisContent } from '@/server/actions/analysis.actions'
import { safeStorage, CACHE_CONSTANTS } from '@/lib/cache-utils'

const STORAGE_KEY = 'brainlm:analysis-cache'
const STORAGE_VERSION = 1

// Cached analysis with metadata
export interface CachedAnalysis {
  content: AnalysisContent
  isComplete: boolean
  cachedAt: string
}

interface AnalysisCacheState {
  // Analysis cache by event ID (max 200, LRU eviction)
  analysis: Record<string, CachedAnalysis>
  // Track order for LRU eviction (most recently accessed first)
  accessOrder: string[]
}

interface AnalysisCacheActions {
  // Set completed analysis
  setCompleted: (eventId: string, content: AnalysisContent) => void
  // Set partial/incomplete analysis (for caching during polling)
  setPartial: (eventId: string, content: AnalysisContent) => void
  // Get analysis (returns undefined if not cached)
  getAnalysis: (eventId: string) => CachedAnalysis | undefined
  // Mark access (for LRU tracking)
  markAccess: (eventId: string) => void
  // Clear cache
  clearCache: () => void
}

type AnalysisCacheStore = AnalysisCacheState & AnalysisCacheActions

const initialState: AnalysisCacheState = {
  analysis: {},
  accessOrder: [],
}

// LRU eviction helper
function enforceMaxAnalysis(
  analysis: Record<string, CachedAnalysis>,
  accessOrder: string[],
  maxItems: number = CACHE_CONSTANTS.MAX_ANALYSIS
): { analysis: Record<string, CachedAnalysis>; accessOrder: string[] } {
  if (accessOrder.length <= maxItems) {
    return { analysis, accessOrder }
  }

  // Keep the most recently accessed items
  const idsToKeep = new Set(accessOrder.slice(0, maxItems))
  const prunedAnalysis: Record<string, CachedAnalysis> = {}

  for (const id of idsToKeep) {
    if (analysis[id]) {
      prunedAnalysis[id] = analysis[id]
    }
  }

  return {
    analysis: prunedAnalysis,
    accessOrder: accessOrder.slice(0, maxItems),
  }
}

export const useAnalysisCache = create<AnalysisCacheStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCompleted: (eventId: string, content: AnalysisContent) => {
        set((state) => {
          const newAnalysis = {
            ...state.analysis,
            [eventId]: {
              content,
              isComplete: true,
              cachedAt: new Date().toISOString(),
            },
          }

          // Update access order (move to front)
          const newAccessOrder = [
            eventId,
            ...state.accessOrder.filter(id => id !== eventId),
          ]

          // Enforce max limit
          return enforceMaxAnalysis(newAnalysis, newAccessOrder)
        })
      },

      setPartial: (eventId: string, content: AnalysisContent) => {
        set((state) => {
          // Don't overwrite completed analysis with partial
          if (state.analysis[eventId]?.isComplete) {
            return state
          }

          const newAnalysis = {
            ...state.analysis,
            [eventId]: {
              content,
              isComplete: false,
              cachedAt: new Date().toISOString(),
            },
          }

          // Update access order (move to front)
          const newAccessOrder = [
            eventId,
            ...state.accessOrder.filter(id => id !== eventId),
          ]

          // Enforce max limit
          return enforceMaxAnalysis(newAnalysis, newAccessOrder)
        })
      },

      getAnalysis: (eventId: string) => {
        return get().analysis[eventId]
      },

      markAccess: (eventId: string) => {
        set((state) => {
          // Only update if the analysis exists
          if (!state.analysis[eventId]) {
            return state
          }

          // Move to front of access order
          const newAccessOrder = [
            eventId,
            ...state.accessOrder.filter(id => id !== eventId),
          ]

          return { accessOrder: newAccessOrder }
        })
      },

      clearCache: () => {
        set(initialState)
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        analysis: state.analysis,
        accessOrder: state.accessOrder,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState) {
          return initialState
        }

        try {
          const state = persistedState as Partial<AnalysisCacheState>
          return {
            analysis: state.analysis ?? {},
            accessOrder: state.accessOrder ?? [],
          }
        } catch {
          console.warn('Failed to migrate analysis cache, resetting')
          return initialState
        }
      },
    }
  )
)

// Legacy export for backward compatibility
export const getCompleted = (eventId: string) =>
  useAnalysisCache.getState().getAnalysis(eventId)?.content

// Selectors
export const selectAnalysis = (eventId: string) => (state: AnalysisCacheStore) =>
  state.analysis[eventId]
export const selectIsComplete = (eventId: string) => (state: AnalysisCacheStore) =>
  state.analysis[eventId]?.isComplete ?? false
