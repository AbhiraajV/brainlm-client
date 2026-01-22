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

  const pollStartTime = useRef<number | null>(null)
  const { getCompleted, setCompleted } = useAnalysisCache()

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
    // Check cache first
    const cached = getCompleted(eventId)
    if (cached) {
      setContent(cached)
      setStatus({
        interpretation: 'present',
        insight: 'present',
        pattern: 'present',
        isComplete: true,
        lastUpdatedAt: null
      })
      return
    }

    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout>

    // Initial fetch - ALWAYS runs regardless of enablePolling
    const initialFetch = async () => {
      if (!mounted) return

      const statusResult = await fetchStatus()

      // OPTIMIZATION: Only fetch content if at least one piece exists
      // Avoids empty Prisma queries when analysis hasn't started yet
      const hasAnyContent =
        statusResult.interpretation === 'present' ||
        statusResult.insight === 'present' ||
        statusResult.pattern === 'present'

      let contentResult: AnalysisContent | null = null
      if (hasAnyContent) {
        contentResult = await fetchContent()
      }

      const complete = isAnalysisComplete(statusResult)

      if (complete) {
        if (contentResult && mounted) {
          setCompleted(eventId, contentResult)
        }
        return
      }

      // For old events (>1 day), don't poll if first fetch shows incomplete data
      // Analysis is done, we just won't get more data
      if (isOldEvent(statusResult.lastUpdatedAt)) {
        return
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
    const poll = async () => {
      if (!mounted) return

      const statusResult = await fetchStatus()

      // Fetch content to check patterns and insights
      const hasAnyContent =
        statusResult.interpretation === 'present' ||
        statusResult.insight === 'present' ||
        statusResult.pattern === 'present'

      let contentResult: AnalysisContent | null = null
      if (hasAnyContent) {
        contentResult = await fetchContent()
      }

      const complete = isAnalysisComplete(statusResult)

      if (complete) {
        if (contentResult && mounted) {
          setCompleted(eventId, contentResult)
          setIsPolling(false)
        }
        return
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

    // Start with initial fetch
    initialFetch()

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [eventId, enablePolling, fetchStatus, fetchContent, getCompleted, setCompleted])

  // Compute completion status
  const computedIsComplete = status ? isAnalysisComplete(status) : false

  return {
    status,
    interpretation: content?.interpretation ?? null,
    insights: content?.insights ?? [],
    patterns: content?.patterns ?? [],
    isPolling,
    isComplete: computedIsComplete,
    thinkingMessages
  }
}
