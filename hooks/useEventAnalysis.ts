'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  getAnalysisStatus,
  getAnalysisContent,
  type AnalysisStatus,
  type AnalysisContent
} from '@/server/actions/analysis.actions'
import { useAnalysisCache } from '@/store/analysis-cache'
import { deduplicatedFetch } from '@/lib/fetch-registry'
import { getUniqueThinkingMessages } from '@/lib/thinking-messages'
import { isRecentEvent } from '@/lib/cache-utils'

// Adaptive polling schedule
const POLL_SCHEDULE = [
  { until: 30_000, interval: 3_000 },   // 0-30s: every 3s
  { until: 150_000, interval: 10_000 }, // 30s-2.5min: every 10s
]
const MAX_POLL_TIME = 150_000 // Stop after 2.5 min
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// Helper to determine if analysis is complete
// All events now generate insights, so we simply check all three are present
function isAnalysisComplete(status: AnalysisStatus): boolean {
  return (
    status.interpretation === 'present' &&
    (status.pattern === 'present' || status.pattern === 'exhausted') &&
    status.insight === 'present'
  )
}

// Helper to determine if event is old (>1 day)
// For old events, we don't poll if first fetch shows missing data
function isOldEvent(lastUpdatedAt: Date | null): boolean {
  if (!lastUpdatedAt) return false
  return Date.now() - new Date(lastUpdatedAt).getTime() > ONE_DAY_MS
}

export function useEventAnalysis(eventId: string, enablePolling: boolean = true) {
  const [status, setStatus] = useState<AnalysisStatus | null>(null)
  const [content, setContent] = useState<AnalysisContent | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [thinkingMessages, setThinkingMessages] = useState<[string, string, string]>(['', '', ''])
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true)

  const pollStartTime = useRef<number | null>(null)
  const { getAnalysis, setCompleted, setPartial, markAccess } = useAnalysisCache()

  const fetchStatus = useCallback(async () => {
    const result = await deduplicatedFetch(
      `status:${eventId}`,
      () => getAnalysisStatus(eventId)
    )
    setStatus(result)
    return result
  }, [eventId])

  const fetchContent = useCallback(async () => {
    const result = await deduplicatedFetch(
      `content:${eventId}`,
      () => getAnalysisContent(eventId)
    )
    setContent(result)
    return result
  }, [eventId])

  useEffect(() => {
    // Check cache first - return immediately if complete
    const cached = getAnalysis(eventId)
    if (cached) {
      // Mark access for LRU tracking
      markAccess(eventId)
      setContent(cached.content)
      setIsLoadingFromCache(false)

      // If complete, don't fetch at all
      if (cached.isComplete) {
        setStatus({
          interpretation: 'present',
          insight: 'present',
          pattern: 'present',
          isComplete: true,
          lastUpdatedAt: null
        })
        return
      }

      // If incomplete but cached, show cached data while potentially polling
      // (only for recent events)
    }

    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout>

    // Initial fetch - ALWAYS runs regardless of enablePolling
    // PARALLELIZED: Fetch status and content simultaneously
    const initialFetch = async () => {
      if (!mounted) return

      // Parallel fetch - content returns null gracefully if nothing exists
      const [statusResult, contentResult] = await Promise.all([
        fetchStatus(),
        fetchContent()
      ])
      setIsLoadingFromCache(false)

      const complete = isAnalysisComplete(statusResult)

      if (complete) {
        if (contentResult && mounted) {
          // Cache as complete
          setCompleted(eventId, contentResult)
        }
        return
      }

      // For old events (>1 day), cache as-is (no polling)
      // Analysis is done, we just won't get more data
      if (isOldEvent(statusResult.lastUpdatedAt)) {
        if (contentResult && mounted) {
          // Cache partial analysis for old events
          setPartial(eventId, contentResult)
        }
        return
      }

      // Cache partial analysis while polling
      if (contentResult && mounted) {
        setPartial(eventId, contentResult)
      }

      // Only start polling if enabled AND analysis is incomplete
      if (enablePolling && mounted) {
        pollStartTime.current = Date.now()
        setIsPolling(true)
        setThinkingMessages(getUniqueThinkingMessages())
        schedulePoll()
      }
    }

    // Polling loop - only runs if enablePolling is true
    // PARALLELIZED: Fetch status and content simultaneously
    const poll = async () => {
      if (!mounted) return

      // Parallel fetch
      const [statusResult, contentResult] = await Promise.all([
        fetchStatus(),
        fetchContent()
      ])

      const complete = isAnalysisComplete(statusResult)

      if (complete) {
        if (contentResult && mounted) {
          // Cache as complete
          setCompleted(eventId, contentResult)
          setIsPolling(false)
        }
        return
      }

      // Update partial cache during polling
      if (contentResult && mounted) {
        setPartial(eventId, contentResult)
      }

      // Check if we should continue polling
      const elapsed = Date.now() - (pollStartTime.current ?? Date.now())
      if (elapsed >= MAX_POLL_TIME) {
        setIsPolling(false)
        return
      }

      setThinkingMessages(getUniqueThinkingMessages())
      schedulePoll()
    }

    const schedulePoll = () => {
      const elapsed = Date.now() - (pollStartTime.current ?? Date.now())
      const schedule = POLL_SCHEDULE.find(s => elapsed < s.until)
      const interval = schedule?.interval ?? 10_000
      timeoutId = setTimeout(poll, interval)
    }

    // Start with initial fetch (unless we have complete cached data)
    if (!cached?.isComplete) {
      initialFetch()
    }

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [eventId, enablePolling, fetchStatus, fetchContent, getAnalysis, setCompleted, setPartial, markAccess])

  // Compute completion status
  const computedIsComplete = status ? isAnalysisComplete(status) : false

  return {
    status,
    interpretation: content?.interpretation ?? null,
    insights: content?.insights ?? [],
    patterns: content?.patterns ?? [],
    isPolling,
    isComplete: computedIsComplete,
    isLoadingFromCache,
    thinkingMessages
  }
}
