'use client';

/**
 * useSessionAnalysisWithCache
 *
 * Hook that manages session analysis with client-side caching.
 * Uses delta fetching and incremental LLM updates to minimize costs.
 *
 * Cache Flow:
 * 1. Check local cache (Zustand/localStorage)
 * 2. If cache exists and valid:
 *    - Fetch delta events since last analysis
 *    - If no delta: return cached analysis
 *    - If delta < 50: incremental LLM update (gpt-4o-mini)
 *    - If delta > 50: full regeneration (gpt-4o)
 * 3. If cache doesn't exist or is invalid:
 *    - Full analysis generation
 *    - Save to cache
 *
 * Cache Invalidation:
 * - User baseline changed (hash mismatch)
 * - Cache too old (>7 days)
 * - Too many new events (>50 delta)
 */

import { useCallback, useRef } from 'react';
import { useCacheStore } from '@/store/cache.store';
import {
  analyzeSession,
  analyzeSessionIncrementalStateless,
} from '@/server/actions/session-analysis.actions';
import { fetchAnalysisDeltaEvents, getBaselineHash } from '@/server/actions/knowledge-delta.actions';
import type {
  SessionKnowledge,
  SessionAnalysis,
  TrackerType,
  CachedAnalysis,
} from '@/lib/sessions/types';

const MAX_CACHE_AGE_DAYS = 7;
const MAX_DELTA_EVENTS = 50;

interface UseSessionAnalysisResult {
  analyzeWithCache: (
    title: string,
    context: string,
    knowledge: SessionKnowledge,
    trackerType: TrackerType
  ) => Promise<{
    analysis: SessionAnalysis;
    fromCache: boolean;
    deltaApplied: boolean;
  } | null>;
  clearCache: (trackerType?: TrackerType) => void;
}

/**
 * Check if cache should be invalidated
 */
function shouldInvalidateCache(
  cache: CachedAnalysis,
  currentBaselineHash: string | null,
  deltaEventCount: number
): { invalidate: boolean; reason: string } {
  // Too many delta events - incremental update unreliable
  if (deltaEventCount > MAX_DELTA_EVENTS) {
    return { invalidate: true, reason: 'too many delta events' };
  }

  // Baseline changed
  if (cache.baselineHash !== currentBaselineHash) {
    return { invalidate: true, reason: 'baseline changed' };
  }

  // Cache too old
  const cacheAge = Date.now() - new Date(cache.generatedAt).getTime();
  const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (cacheAge > maxAge) {
    return { invalidate: true, reason: 'cache too old' };
  }

  return { invalidate: false, reason: '' };
}

export function useSessionAnalysisWithCache(): UseSessionAnalysisResult {
  // Use stable selectors that return functions, not state objects
  // This prevents the callback from being recreated when cache state changes
  const setAnalysisCache = useCacheStore((s) => s.setAnalysisCache);
  const updateAnalysisCache = useCacheStore((s) => s.updateAnalysisCache);
  const clearAnalysisCache = useCacheStore((s) => s.clearAnalysisCache);

  // Track in-flight requests to prevent duplicates
  const inFlightRef = useRef<Set<string>>(new Set());

  const analyzeWithCache = useCallback(
    async (
      title: string,
      context: string,
      knowledge: SessionKnowledge,
      trackerType: TrackerType
    ): Promise<{
      analysis: SessionAnalysis;
      fromCache: boolean;
      deltaApplied: boolean;
    } | null> => {
      const cacheKey = trackerType;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[ANALYSIS CACHE] Starting analysis for:', trackerType);
      console.log('[ANALYSIS CACHE] Title:', title);

      // Prevent duplicate requests
      if (inFlightRef.current.has(cacheKey)) {
        console.log('[ANALYSIS CACHE] ⚠️ Request already in flight, skipping');
        return null;
      }

      inFlightRef.current.add(cacheKey);

      try {
        // Check local cache - read directly from store to avoid stale closures
        const cachedAnalysis = useCacheStore.getState().analysisCache[trackerType];
        console.log('[ANALYSIS CACHE] Local cache exists?', !!cachedAnalysis);

        if (cachedAnalysis) {
          console.log('[ANALYSIS CACHE] ✅ Found cache for:', trackerType);
          console.log('[ANALYSIS CACHE] Cache generated at:', cachedAnalysis.generatedAt);
          console.log('[ANALYSIS CACHE] Cache has:', {
            sessionType: cachedAnalysis.analysis.sessionType,
            historyCount: cachedAnalysis.analysis.relevantHistory.length,
            patternsCount: cachedAnalysis.analysis.patterns.length,
            lastEventAt: cachedAnalysis.lastEventAt,
            eventCount: cachedAnalysis.eventCount,
          });

          // Try to get current baseline hash - but don't fail if server is unavailable
          let currentBaselineHash: string | null = null;
          try {
            currentBaselineHash = await getBaselineHash();
            console.log('[ANALYSIS CACHE] Current baseline hash:', currentBaselineHash?.slice(0, 8) || 'null');
          } catch (hashError) {
            console.warn('[ANALYSIS CACHE] ⚠️ Could not fetch baseline hash, assuming unchanged');
            currentBaselineHash = cachedAnalysis.baselineHash; // Assume unchanged
          }
          console.log('[ANALYSIS CACHE] Cached baseline hash:', cachedAnalysis.baselineHash?.slice(0, 8) || 'null');

          // Try to fetch delta events - but don't fail if server is unavailable
          let deltaResult: { events: { id: string; content: string; occurredAt: string; rawJson: unknown }[] } | null = null;
          try {
            console.log('[ANALYSIS CACHE] 🔄 Fetching delta events since:', cachedAnalysis.lastEventAt);
            deltaResult = await fetchAnalysisDeltaEvents(
              trackerType,
              cachedAnalysis.lastEventAt
            );
          } catch (deltaError) {
            console.warn('[ANALYSIS CACHE] ⚠️ Delta fetch failed, returning cached analysis (offline-resilient)');
            return {
              analysis: cachedAnalysis.analysis,
              fromCache: true,
              deltaApplied: false,
            };
          }

          // If delta fetch returned null, also return cached
          if (!deltaResult) {
            console.warn('[ANALYSIS CACHE] ⚠️ Delta fetch returned null, returning cached analysis (offline-resilient)');
            return {
              analysis: cachedAnalysis.analysis,
              fromCache: true,
              deltaApplied: false,
            };
          }

          const deltaEventCount = deltaResult.events.length;
          console.log('[ANALYSIS CACHE] Delta events found:', deltaEventCount);

          // Check if cache should be invalidated
          const { invalidate, reason } = shouldInvalidateCache(
            cachedAnalysis,
            currentBaselineHash,
            deltaEventCount
          );

          if (invalidate) {
            console.log('[ANALYSIS CACHE] ❌ Cache invalidated:', reason);
            // Fall through to full analysis
          } else if (deltaEventCount === 0) {
            // No new events - return cached analysis (no LLM call!)
            console.log('[ANALYSIS CACHE] 🎯 CACHE HIT! No new events, returning cached analysis');
            console.log('[ANALYSIS CACHE] 💰 Saved ~$0.10-0.20 in LLM costs!');
            return {
              analysis: cachedAnalysis.analysis,
              fromCache: true,
              deltaApplied: false,
            };
          } else {
            // Incremental update with delta events
            console.log('[ANALYSIS CACHE] 🔀 Incremental update with', deltaEventCount, 'events');
            console.log('[ANALYSIS CACHE] 💰 Using gpt-4o-mini (~$0.01) instead of gpt-4o (~$0.15)');

            try {
              const updatedAnalysis = await analyzeSessionIncrementalStateless(
                cachedAnalysis.analysis,
                deltaResult.events.map((e) => ({
                  id: e.id,
                  content: e.content,
                  occurredAt: new Date(e.occurredAt),
                  rawJson: e.rawJson,
                })),
                trackerType
              );

              if (updatedAnalysis) {
                console.log('[ANALYSIS CACHE] ✅ Incremental update successful');
                // Update cache with new analysis
                const lastEvent = deltaResult.events[deltaResult.events.length - 1];

                const updatedCache: CachedAnalysis = {
                  analysis: updatedAnalysis,
                  lastEventId: lastEvent.id,
                  lastEventAt: lastEvent.occurredAt,
                  eventCount: cachedAnalysis.eventCount + deltaEventCount,
                  baselineHash: currentBaselineHash,
                  generatedAt: new Date().toISOString(),
                };

                setAnalysisCache(trackerType, updatedCache);
                console.log('[ANALYSIS CACHE] 💾 Cache updated with incremental changes');

                return {
                  analysis: updatedAnalysis,
                  fromCache: true,
                  deltaApplied: true,
                };
              }
            } catch (incrementalError) {
              console.warn('[ANALYSIS CACHE] ⚠️ Incremental update failed, returning cached analysis');
              return {
                analysis: cachedAnalysis.analysis,
                fromCache: true,
                deltaApplied: false,
              };
            }

            // Incremental update returned null - return cached instead of doing full analysis
            console.warn('[ANALYSIS CACHE] ⚠️ Incremental update returned null, returning cached analysis');
            return {
              analysis: cachedAnalysis.analysis,
              fromCache: true,
              deltaApplied: false,
            };
          }
        }

        // Full analysis (no cache or cache invalidated)
        console.log('[ANALYSIS CACHE] 🌐 Doing FULL ANALYSIS for:', trackerType);
        console.log('[ANALYSIS CACHE] 💸 This will call gpt-4o (~$0.10-0.20)...');
        const analysis = await analyzeSession(title, context, knowledge, trackerType);

        if (!analysis) {
          console.error('[ANALYSIS CACHE] ❌ Full analysis failed');
          return null;
        }

        console.log('[ANALYSIS CACHE] ✅ Full analysis successful:', {
          sessionType: analysis.sessionType,
          historyCount: analysis.relevantHistory.length,
          patternsCount: analysis.patterns.length,
        });

        // Get baseline hash for cache
        const baselineHash = await getBaselineHash();

        // Find last event for cache tracking
        const sortedEvents = [...knowledge.events].sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
        const lastEvent = sortedEvents[0];

        // Save to cache
        const newCache: CachedAnalysis = {
          analysis,
          lastEventId: lastEvent?.id || null,
          lastEventAt: lastEvent?.occurredAt || null,
          eventCount: knowledge.events.length,
          baselineHash,
          generatedAt: new Date().toISOString(),
        };

        setAnalysisCache(trackerType, newCache);
        console.log('[ANALYSIS CACHE] 💾 New cache saved for:', trackerType);
        console.log('[ANALYSIS CACHE] Next session will use this cache!');

        return {
          analysis,
          fromCache: false,
          deltaApplied: false,
        };
      } catch (error) {
        console.error('[useSessionAnalysisWithCache] Error:', error);
        return null;
      } finally {
        inFlightRef.current.delete(cacheKey);
      }
    },
    [setAnalysisCache]
  );

  const clearCache = useCallback(
    (trackerType?: TrackerType) => {
      clearAnalysisCache(trackerType);
    },
    [clearAnalysisCache]
  );

  return { analyzeWithCache, clearCache };
}
