'use client'

import { useMemo, useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { UOMSuggestionList } from '@/components/profile/UOMSuggestionList'
import { BackButton } from '@/components/ui/BackButton'
import { useUOMSuggestions } from '@/hooks/useDailyData'
import { useDailyDataStore } from '@/store/daily-data.store'
import { useHydrated } from '@/hooks/useHydrated'
import { readCacheSync, isFetchedToday } from '@/lib/cache-utils'
import { getBaseline } from '@/server/actions/onboarding.actions'
import { type UOMSuggestionData } from '@/components/profile/UOMSuggestionCard'

const STORAGE_KEY = 'brainlm:daily-data'

/**
 * Read cached baseline synchronously from localStorage.
 */
function getInitialCachedBaseline(): { content: string | null; isFresh: boolean } {
  const cache = readCacheSync<{
    baseline: { content: string | null; lastFetchedAt: string | null }
  }>(STORAGE_KEY)

  if (!cache?.baseline) {
    return { content: null, isFresh: false }
  }

  // Fresh if fetched today (midnight boundary)
  const isFresh = isFetchedToday(cache.baseline.lastFetchedAt)

  return { content: cache.baseline.content, isFresh }
}

// Auth + baseline check already done in (app)/layout.tsx
// Client component that shows cached data instantly
export default function MePage() {
  const hydrated = useHydrated()
  const hasFetched = useRef(false)
  const [isLoading, setIsLoading] = useState(false)

  const { baseline, setBaseline } = useDailyDataStore()
  const { suggestions: cachedSuggestions, isRefreshing: suggestionsLoading } = useUOMSuggestions()

  // Read cache synchronously on first render
  const initialCache = useMemo(() => getInitialCachedBaseline(), [])

  // Fetch baseline if needed (only if not fetched today)
  useEffect(() => {
    if (!hydrated || hasFetched.current) return

    const cachedContent = baseline.content ?? initialCache.content
    const fetchedToday = isFetchedToday(baseline.lastFetchedAt)

    // Only fetch if we haven't fetched today AND have no content
    const needsFetch = !fetchedToday && !cachedContent

    if (needsFetch) {
      setIsLoading(true)
      getBaseline()
        .then((content) => {
          setBaseline(content)
        })
        .catch((err) => {
          console.error('Failed to fetch baseline:', err)
        })
        .finally(() => {
          setIsLoading(false)
          hasFetched.current = true
        })
    } else {
      hasFetched.current = true
    }
  }, [hydrated, baseline.content, baseline.lastFetchedAt, initialCache.content, setBaseline])

  // Transform cached suggestions to UOMSuggestionData format
  const suggestions: UOMSuggestionData[] = useMemo(() => {
    return cachedSuggestions.map(s => ({
      id: s.id,
      suggestion: s.suggestion,
      reasoning: s.reasoning,
      driftType: s.driftType,
      confidence: 'HIGH' as const, // Default confidence
      targetSection: null, // Not in cached type
      createdAt: new Date(s.createdAt),
    }))
  }, [cachedSuggestions])

  // Use cached baseline or initial cache
  const displayBaseline = hydrated ? baseline.content : initialCache.content

  const showLoading = isLoading && !displayBaseline

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="
        sticky top-0 z-10
        h-14
        flex items-center justify-between
        px-5 sm:px-7
        bg-[var(--color-surface)]
        border-b border-[var(--color-line)]
      ">
        <div className="font-serif font-semibold text-lg text-[var(--color-text)]">
          About Me
        </div>
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-60" />
      </header>

      {/* Main content */}
      <main className="flex-1 py-6 sm:py-8 pb-24 px-4 sm:px-6">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <Loader2 className="w-8 h-8 text-[var(--color-muted)] animate-spin mb-4" />
            <p className="text-sm text-[var(--color-muted)]">Loading profile...</p>
          </div>
        ) : (
          <>
            {/* UOM Suggestions section */}
            <UOMSuggestionList suggestions={suggestions} />

            {/* Divider if suggestions exist */}
            {suggestions.length > 0 && (
              <div className="divider my-8" />
            )}

            {/* Baseline section */}
            <p className="text-sm font-semibold italic text-[var(--color-muted)] mb-6">
              A slice of our ever evolving understanding of you! (we don&apos;t recommend visiting this page often — our goal is to do the heavy lifting for you)
            </p>
            <div className="prose-baseline">
              <MarkdownRenderer content={displayBaseline || ''} />
            </div>
          </>
        )}
      </main>

      {/* Fixed back button - bottom left (uses browser history for instant nav) */}
      <BackButton />
    </div>
  )
}
