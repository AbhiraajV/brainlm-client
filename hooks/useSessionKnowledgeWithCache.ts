'use client';

/**
 * useSessionKnowledgeWithCache
 *
 * Hook that fetches session knowledge with client-side caching.
 * Uses delta fetching when cache exists, full fetch otherwise.
 *
 * Cache Flow:
 * 1. Check local cache (Zustand/localStorage)
 * 2. If cache exists and valid:
 *    - Fetch delta (new items since last fetch)
 *    - Merge delta into cache
 *    - Return merged result
 * 3. If cache doesn't exist or is invalid:
 *    - Full fetch
 *    - Save to cache
 *    - Return result
 *
 * Cache Invalidation:
 * - User baseline changed (hash mismatch)
 * - Cache too old (>7 days)
 * - Too many new items (>50 total delta)
 */

import { useCallback, useRef } from 'react';
import { useCacheStore } from '@/store/cache.store';
import { fetchSessionKnowledge } from '@/server/actions/session-knowledge.actions';
import { fetchKnowledgeDelta, getBaselineHash } from '@/server/actions/knowledge-delta.actions';
import type {
  SessionKnowledge,
  TrackerType,
  CachedKnowledge,
  KnowledgeCacheTimestamps,
} from '@/lib/sessions/types';

const MAX_CACHE_AGE_DAYS = 7;
const MAX_DELTA_ITEMS = 50;

interface UseSessionKnowledgeResult {
  fetchKnowledge: (trackerType: TrackerType) => Promise<{
    knowledge: SessionKnowledge;
    fromCache: boolean;
    deltaApplied: boolean;
  } | null>;
  clearCache: (trackerType?: TrackerType) => void;
}

/**
 * Merge delta items into cached knowledge
 */
function mergeKnowledgeDelta(
  cached: SessionKnowledge,
  delta: {
    events: SessionKnowledge['events'];
    interpretations: SessionKnowledge['interpretations'];
    patterns: SessionKnowledge['patterns'];
    insights: SessionKnowledge['insights'];
    reviews: SessionKnowledge['reviews'];
  },
  fresh: {
    todaysEvents: SessionKnowledge['todaysEvents'];
    yesterdaysReview: SessionKnowledge['yesterdaysReview'] | null;
    todaysPlan: SessionKnowledge['todaysPlan'] | null;
    userBaseline: string | null;
  }
): SessionKnowledge {
  // Create ID sets for deduplication
  const existingEventIds = new Set(cached.events.map((e) => e.id));
  const existingInterpretationIds = new Set(cached.interpretations.map((i) => i.id));
  const existingPatternIds = new Set(cached.patterns.map((p) => p.id));
  const existingInsightIds = new Set(cached.insights.map((i) => i.id));
  const existingReviewIds = new Set(cached.reviews.map((r) => r.id));

  // Merge with deduplication
  const mergedEvents = [
    ...cached.events,
    ...delta.events.filter((e) => !existingEventIds.has(e.id)),
  ];
  const mergedInterpretations = [
    ...cached.interpretations,
    ...delta.interpretations.filter((i) => !existingInterpretationIds.has(i.id)),
  ];
  const mergedPatterns = [
    ...cached.patterns,
    ...delta.patterns.filter((p) => !existingPatternIds.has(p.id)),
  ];
  const mergedInsights = [
    ...cached.insights,
    ...delta.insights.filter((i) => !existingInsightIds.has(i.id)),
  ];
  const mergedReviews = [
    ...cached.reviews,
    ...delta.reviews.filter((r) => !existingReviewIds.has(r.id)),
  ];

  return {
    ...cached,
    events: mergedEvents,
    interpretations: mergedInterpretations,
    patterns: mergedPatterns,
    insights: mergedInsights,
    reviews: mergedReviews,
    // Fresh data is always replaced
    todaysEvents: fresh.todaysEvents || [],
    yesterdaysReview: fresh.yesterdaysReview || undefined,
    todaysPlan: fresh.todaysPlan || undefined,
    userBaseline: fresh.userBaseline || undefined,
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Check if cache should be invalidated
 */
function shouldInvalidateCache(
  cache: CachedKnowledge,
  currentBaselineHash: string | null
): boolean {
  // Baseline changed
  if (cache.baselineHash !== currentBaselineHash) {
    console.log('[useSessionKnowledgeWithCache] Cache invalidated: baseline changed');
    return true;
  }

  // Cache too old
  const cacheAge = Date.now() - new Date(cache.generatedAt).getTime();
  const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (cacheAge > maxAge) {
    console.log('[useSessionKnowledgeWithCache] Cache invalidated: too old');
    return true;
  }

  return false;
}

export function useSessionKnowledgeWithCache(): UseSessionKnowledgeResult {
  // Use stable selectors that return functions, not state objects
  // This prevents the callback from being recreated when cache state changes
  const setKnowledgeCache = useCacheStore((s) => s.setKnowledgeCache);
  const updateKnowledgeCache = useCacheStore((s) => s.updateKnowledgeCache);
  const clearKnowledgeCache = useCacheStore((s) => s.clearKnowledgeCache);

  // Track in-flight requests to prevent duplicates
  const inFlightRef = useRef<Set<string>>(new Set());

  const fetchKnowledge = useCallback(
    async (
      trackerType: TrackerType
    ): Promise<{
      knowledge: SessionKnowledge;
      fromCache: boolean;
      deltaApplied: boolean;
    } | null> => {
      const cacheKey = trackerType;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[KNOWLEDGE CACHE] Starting fetch for:', trackerType);

      // Don't fetch for general or habit sessions (habit uses no LLM during tracking)
      if (trackerType === 'general' || trackerType === 'habit') {
        console.log('[KNOWLEDGE CACHE] ⚠️', trackerType, 'sessions not supported');
        return null;
      }

      // Prevent duplicate requests
      if (inFlightRef.current.has(cacheKey)) {
        console.log('[KNOWLEDGE CACHE] ⚠️ Request already in flight, skipping');
        return null;
      }

      inFlightRef.current.add(cacheKey);

      try {
        // Check local cache - read directly from store to avoid stale closures
        const cachedKnowledge = useCacheStore.getState().knowledgeCache[trackerType];
        console.log('[KNOWLEDGE CACHE] Local cache exists?', !!cachedKnowledge);

        if (cachedKnowledge) {
          console.log('[KNOWLEDGE CACHE] ✅ Found cache for:', trackerType);
          console.log('[KNOWLEDGE CACHE] Cache generated at:', cachedKnowledge.generatedAt);
          console.log('[KNOWLEDGE CACHE] Cache has:', {
            events: cachedKnowledge.knowledge.events.length,
            interpretations: cachedKnowledge.knowledge.interpretations.length,
            patterns: cachedKnowledge.knowledge.patterns.length,
            insights: cachedKnowledge.knowledge.insights.length,
          });

          // Check if cache should be invalidated
          const currentBaselineHash = await getBaselineHash();
          console.log(
            '[KNOWLEDGE CACHE] Current baseline hash:',
            currentBaselineHash?.slice(0, 8) || 'null'
          );
          console.log(
            '[KNOWLEDGE CACHE] Cached baseline hash:',
            cachedKnowledge.baselineHash?.slice(0, 8) || 'null'
          );

          if (shouldInvalidateCache(cachedKnowledge, currentBaselineHash)) {
            console.log('[KNOWLEDGE CACHE] ❌ Cache invalidated, doing full fetch');
            // Fall through to full fetch
          } else {
            // Try delta fetch
            console.log('[KNOWLEDGE CACHE] 🔄 Attempting delta fetch...');
            const deltaResult = await fetchKnowledgeDelta(trackerType, cachedKnowledge.timestamps);

            if (deltaResult) {
              const totalDelta =
                deltaResult.delta.events.length +
                deltaResult.delta.interpretations.length +
                deltaResult.delta.patterns.length +
                deltaResult.delta.insights.length +
                deltaResult.delta.reviews.length;

              console.log('[KNOWLEDGE CACHE] Delta result:', {
                events: deltaResult.delta.events.length,
                interpretations: deltaResult.delta.interpretations.length,
                patterns: deltaResult.delta.patterns.length,
                insights: deltaResult.delta.insights.length,
                reviews: deltaResult.delta.reviews.length,
                totalDelta,
              });

              if (totalDelta > MAX_DELTA_ITEMS) {
                console.log(
                  '[KNOWLEDGE CACHE] ⚠️ Too many delta items:',
                  totalDelta,
                  '> 50, doing full fetch'
                );
                // Fall through to full fetch
              } else if (totalDelta === 0) {
                // No new items, just update fresh data
                console.log(
                  '[KNOWLEDGE CACHE] 🎯 CACHE HIT! No new items, returning cached knowledge'
                );

                const updatedKnowledge = mergeKnowledgeDelta(
                  cachedKnowledge.knowledge,
                  { events: [], interpretations: [], patterns: [], insights: [], reviews: [] },
                  {
                    todaysEvents: deltaResult.fresh.todaysEvents,
                    yesterdaysReview: deltaResult.fresh.yesterdaysReview,
                    todaysPlan: deltaResult.fresh.todaysPlan,
                    userBaseline: deltaResult.fresh.userBaseline,
                  }
                );

                // Update cache with fresh data
                updateKnowledgeCache(trackerType, {
                  knowledge: updatedKnowledge,
                  baselineHash: deltaResult.baselineHash,
                });

                return {
                  knowledge: updatedKnowledge,
                  fromCache: true,
                  deltaApplied: false,
                };
              } else {
                // Merge delta into cache
                console.log('[KNOWLEDGE CACHE] 🔀 Merging', totalDelta, 'delta items into cache');

                const mergedKnowledge = mergeKnowledgeDelta(
                  cachedKnowledge.knowledge,
                  deltaResult.delta,
                  {
                    todaysEvents: deltaResult.fresh.todaysEvents,
                    yesterdaysReview: deltaResult.fresh.yesterdaysReview,
                    todaysPlan: deltaResult.fresh.todaysPlan,
                    userBaseline: deltaResult.fresh.userBaseline,
                  }
                );

                // Update cache
                updateKnowledgeCache(trackerType, {
                  knowledge: mergedKnowledge,
                  timestamps: deltaResult.delta.timestamps,
                  baselineHash: deltaResult.baselineHash,
                });

                return {
                  knowledge: mergedKnowledge,
                  fromCache: true,
                  deltaApplied: true,
                };
              }
            } else {
              // Delta fetch failed, but we have valid cache - just return it
              console.log(
                '[KNOWLEDGE CACHE] ⚠️ Delta fetch failed, returning cached knowledge (offline-resilient)'
              );
              return {
                knowledge: cachedKnowledge.knowledge,
                fromCache: true,
                deltaApplied: false,
              };
            }
          }
        }

        // Full fetch (no cache or cache invalidated)
        console.log('[KNOWLEDGE CACHE] 🌐 Doing FULL FETCH for:', trackerType);
        console.log('[KNOWLEDGE CACHE] Using trackerType-based queries (no embeddings)...');
        const result = await fetchSessionKnowledge(trackerType);

        if (!result) {
          console.error('[KNOWLEDGE CACHE] ❌ Full fetch failed');
          return null;
        }

        console.log('[KNOWLEDGE CACHE] ✅ Full fetch successful:', {
          events: result.knowledge.events.length,
          interpretations: result.knowledge.interpretations.length,
          patterns: result.knowledge.patterns.length,
          insights: result.knowledge.insights.length,
        });

        // Calculate timestamps from fetched data
        const timestamps: KnowledgeCacheTimestamps = {
          lastInterpretationAt:
            result.knowledge.interpretations.length > 0
              ? result.knowledge.interpretations.reduce(
                  (latest, i) => (i.createdAt > latest ? i.createdAt : latest),
                  ''
                )
              : null,
          lastPatternAt: null, // Patterns don't have createdAt in current schema
          lastInsightAt:
            result.knowledge.insights.length > 0
              ? result.knowledge.insights.reduce(
                  (latest, i) => (i.createdAt > latest ? i.createdAt : latest),
                  ''
                )
              : null,
          lastReviewAt: null, // Reviews need createdAt from fetch
          lastEventAt:
            result.knowledge.events.length > 0
              ? result.knowledge.events.reduce(
                  (latest, e) => (e.occurredAt > latest ? e.occurredAt : latest),
                  ''
                )
              : null,
        };

        // Get baseline hash
        const baselineHash = await getBaselineHash();

        // Save to cache
        const newCache: CachedKnowledge = {
          knowledge: result.knowledge,
          seed: '', // Deprecated - no longer used
          timestamps,
          baselineHash,
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setKnowledgeCache(trackerType, newCache);
        console.log('[KNOWLEDGE CACHE] 💾 New cache saved for:', trackerType);
        console.log('[KNOWLEDGE CACHE] Next session will use this cache!');

        return {
          knowledge: result.knowledge,
          fromCache: false,
          deltaApplied: false,
        };
      } catch (error) {
        console.error('[useSessionKnowledgeWithCache] Error:', error);
        return null;
      } finally {
        inFlightRef.current.delete(cacheKey);
      }
    },
    [setKnowledgeCache, updateKnowledgeCache]
  );

  const clearCache = useCallback(
    (trackerType?: TrackerType) => {
      clearKnowledgeCache(trackerType);
    },
    [clearKnowledgeCache]
  );

  return { fetchKnowledge, clearCache };
}
