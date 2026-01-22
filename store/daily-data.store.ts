import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage, isStale, CACHE_CONSTANTS } from '@/lib/cache-utils'

const STORAGE_KEY = 'brainlm:daily-data'
const STORAGE_VERSION = 1

// Types for cached daily data
export interface CachedReview {
  id: string
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  periodKey: string
  periodStart: string
  periodEnd: string
  summary: string
  renderedMarkdown: string | null
  eventIds: string[]
  interpretationIds: string[]
  patternIds: string[]
  insightIds: string[]
  createdAt: string
}

export interface CachedDailyPlan {
  id: string
  renderedMarkdown: string
  targetDate: string
  createdAt: string
  reviewId: string
  focusAreas: unknown[]
  sessions: unknown[]
  warnings: unknown[]
  ctas: unknown[]
}

export interface CachedUOMSuggestion {
  id: string
  suggestion: string
  reasoning: string
  driftType: 'ADDITION' | 'MODIFICATION' | 'REMOVAL'
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IGNORED' | 'EXPIRED'
  statusChangedAt: string | null
  createdAt: string
}

interface FetchRecord {
  fetchedAt: string
  count: number
}

interface DailyDataState {
  // Reviews cache
  reviews: {
    items: Record<string, CachedReview>
    itemIds: string[]  // Ordered by periodStart desc
    lastFetchedAt: string | null
    fetchHistory: FetchRecord[]
    nextCursor: string | null
    hasMore: boolean
  }
  // Daily plans cache
  dailyPlans: {
    items: Record<string, CachedDailyPlan>
    itemIds: string[]  // Ordered by targetDate desc
    lastFetchedAt: string | null
    fetchHistory: FetchRecord[]
    nextCursor: string | null
    hasMore: boolean
  }
  // UOM suggestions cache
  uomSuggestions: {
    items: CachedUOMSuggestion[]
    lastFetchedAt: string | null
  }
  // Baseline cache
  baseline: {
    content: string | null
    lastFetchedAt: string | null
  }
}

interface DailyDataActions {
  // Reviews
  setReviews: (reviews: CachedReview[], nextCursor?: string, hasMore?: boolean) => void
  appendReviews: (reviews: CachedReview[], nextCursor?: string, hasMore?: boolean) => void
  getReview: (id: string) => CachedReview | undefined
  isReviewsStale: () => boolean

  // Daily plans
  setDailyPlans: (plans: CachedDailyPlan[], nextCursor?: string, hasMore?: boolean) => void
  appendDailyPlans: (plans: CachedDailyPlan[], nextCursor?: string, hasMore?: boolean) => void
  getDailyPlan: (id: string) => CachedDailyPlan | undefined
  getDailyPlanByDate: (dateKey: string) => CachedDailyPlan | undefined
  isDailyPlansStale: () => boolean

  // UOM suggestions
  setUOMSuggestions: (suggestions: CachedUOMSuggestion[]) => void
  updateUOMSuggestion: (id: string, updates: Partial<CachedUOMSuggestion>) => void
  removeUOMSuggestion: (id: string) => void
  isUOMSuggestionsStale: () => boolean

  // Baseline
  setBaseline: (content: string | null) => void
  isBaselineStale: () => boolean

  // Clear cache
  clearCache: () => void
}

type DailyDataStore = DailyDataState & DailyDataActions

const initialState: DailyDataState = {
  reviews: {
    items: {},
    itemIds: [],
    lastFetchedAt: null,
    fetchHistory: [],
    nextCursor: null,
    hasMore: true,
  },
  dailyPlans: {
    items: {},
    itemIds: [],
    lastFetchedAt: null,
    fetchHistory: [],
    nextCursor: null,
    hasMore: true,
  },
  uomSuggestions: {
    items: [],
    lastFetchedAt: null,
  },
  baseline: {
    content: null,
    lastFetchedAt: null,
  },
}

export const useDailyDataStore = create<DailyDataStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Reviews
      setReviews: (reviews, nextCursor, hasMore = true) => {
        const items: Record<string, CachedReview> = {}
        const itemIds: string[] = []

        for (const review of reviews) {
          items[review.id] = review
          itemIds.push(review.id)
        }

        set((state) => ({
          reviews: {
            items,
            itemIds,
            lastFetchedAt: new Date().toISOString(),
            fetchHistory: [
              ...state.reviews.fetchHistory,
              { fetchedAt: new Date().toISOString(), count: reviews.length },
            ].slice(-10),  // Keep last 10 fetches
            nextCursor: nextCursor ?? null,
            hasMore,
          },
        }))
      },

      appendReviews: (reviews, nextCursor, hasMore = true) => {
        set((state) => {
          const newItems = { ...state.reviews.items }
          const newItemIds = [...state.reviews.itemIds]

          for (const review of reviews) {
            if (!newItems[review.id]) {
              newItems[review.id] = review
              newItemIds.push(review.id)
            }
          }

          return {
            reviews: {
              ...state.reviews,
              items: newItems,
              itemIds: newItemIds,
              nextCursor: nextCursor ?? null,
              hasMore,
            },
          }
        })
      },

      getReview: (id) => get().reviews.items[id],

      isReviewsStale: () => isStale(get().reviews.lastFetchedAt, CACHE_CONSTANTS.STALE_THRESHOLD_MS),

      // Daily plans
      setDailyPlans: (plans, nextCursor, hasMore = true) => {
        const items: Record<string, CachedDailyPlan> = {}
        const itemIds: string[] = []

        for (const plan of plans) {
          items[plan.id] = plan
          itemIds.push(plan.id)
        }

        set((state) => ({
          dailyPlans: {
            items,
            itemIds,
            lastFetchedAt: new Date().toISOString(),
            fetchHistory: [
              ...state.dailyPlans.fetchHistory,
              { fetchedAt: new Date().toISOString(), count: plans.length },
            ].slice(-10),
            nextCursor: nextCursor ?? null,
            hasMore,
          },
        }))
      },

      appendDailyPlans: (plans, nextCursor, hasMore = true) => {
        set((state) => {
          const newItems = { ...state.dailyPlans.items }
          const newItemIds = [...state.dailyPlans.itemIds]

          for (const plan of plans) {
            if (!newItems[plan.id]) {
              newItems[plan.id] = plan
              newItemIds.push(plan.id)
            }
          }

          return {
            dailyPlans: {
              ...state.dailyPlans,
              items: newItems,
              itemIds: newItemIds,
              nextCursor: nextCursor ?? null,
              hasMore,
            },
          }
        })
      },

      getDailyPlan: (id) => get().dailyPlans.items[id],

      getDailyPlanByDate: (dateKey) => {
        const plans = get().dailyPlans
        return plans.itemIds
          .map(id => plans.items[id])
          .find(plan => plan.targetDate.startsWith(dateKey))
      },

      isDailyPlansStale: () => isStale(get().dailyPlans.lastFetchedAt, CACHE_CONSTANTS.STALE_THRESHOLD_MS),

      // UOM suggestions
      setUOMSuggestions: (suggestions) => {
        set({
          uomSuggestions: {
            items: suggestions,
            lastFetchedAt: new Date().toISOString(),
          },
        })
      },

      updateUOMSuggestion: (id, updates) => {
        set((state) => ({
          uomSuggestions: {
            ...state.uomSuggestions,
            items: state.uomSuggestions.items.map(s =>
              s.id === id ? { ...s, ...updates } : s
            ),
          },
        }))
      },

      removeUOMSuggestion: (id) => {
        set((state) => ({
          uomSuggestions: {
            ...state.uomSuggestions,
            items: state.uomSuggestions.items.filter(s => s.id !== id),
          },
        }))
      },

      isUOMSuggestionsStale: () => isStale(get().uomSuggestions.lastFetchedAt, CACHE_CONSTANTS.STALE_THRESHOLD_MS),

      // Baseline
      setBaseline: (content) => {
        set({
          baseline: {
            content,
            lastFetchedAt: new Date().toISOString(),
          },
        })
      },

      isBaselineStale: () => isStale(get().baseline.lastFetchedAt, CACHE_CONSTANTS.STALE_THRESHOLD_MS),

      // Clear cache
      clearCache: () => {
        set(initialState)
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        reviews: state.reviews,
        dailyPlans: state.dailyPlans,
        uomSuggestions: state.uomSuggestions,
        baseline: state.baseline,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState) {
          return initialState
        }

        try {
          const state = persistedState as Partial<DailyDataState>
          return {
            reviews: state.reviews ?? initialState.reviews,
            dailyPlans: state.dailyPlans ?? initialState.dailyPlans,
            uomSuggestions: state.uomSuggestions ?? initialState.uomSuggestions,
            baseline: state.baseline ?? initialState.baseline,
          }
        } catch {
          console.warn('Failed to migrate daily data cache, resetting')
          return initialState
        }
      },
    }
  )
)

// Selectors
export const selectReviews = (state: DailyDataStore) =>
  state.reviews.itemIds.map(id => state.reviews.items[id]).filter(Boolean)

export const selectDailyPlans = (state: DailyDataStore) =>
  state.dailyPlans.itemIds.map(id => state.dailyPlans.items[id]).filter(Boolean)

export const selectUOMSuggestions = (state: DailyDataStore) =>
  state.uomSuggestions.items

export const selectBaseline = (state: DailyDataStore) =>
  state.baseline.content
