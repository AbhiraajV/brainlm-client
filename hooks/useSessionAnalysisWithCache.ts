'use client';

/**
 * useSessionAnalysisWithCache
 *
 * Hook that manages session analysis with client-side caching.
 * Uses delta fetching and delta-only LLM output to minimize costs.
 *
 * Cache Flow:
 * 1. Check local cache (Zustand/localStorage)
 *    - Cache key: trackerType or trackerType:workoutContextKey (per-workout caching)
 * 2. If cache exists and valid:
 *    - Fetch delta events since last analysis
 *    - If no delta: return cached analysis ($0)
 *    - If delta < 50: delta LLM update (gpt-4.1-mini, ~$0.003-0.008)
 *    - If delta > 50: full regeneration (gpt-4.1, ~$0.15)
 * 3. If cache doesn't exist or is invalid:
 *    - Full analysis generation
 *    - Save to cache
 *
 * Cache Invalidation:
 * - User baseline changed (hash mismatch)
 * - Cache too old (>7 days)
 * - Too many new events (>50 delta)
 *
 * Per-workout caching (gym):
 * - Switching from chest→legs checks for "gym:Leg Day:..." cache first
 * - Avoids full re-analysis when rotating between workout days
 * - Max 5 cached analyses per tracker type
 */

import { useCallback, useRef } from 'react';
import { useCacheStore } from '@/store/cache.store';
import {
  analyzeSession,
  analyzeSessionDelta,
  summarizeAnalysis,
} from '@/server/actions/session-analysis.actions';
import { fetchAnalysisDeltaEvents, getBaselineHash } from '@/server/actions/knowledge-delta.actions';
import type {
  SessionKnowledge,
  SessionAnalysis,
  TrackerType,
  CachedAnalysis,
  AnalysisDelta,
} from '@/lib/sessions/types';

const MAX_CACHE_AGE_DAYS = 7;
const MAX_DELTA_EVENTS = 50;

// Array size caps to prevent unbounded growth after repeated merges
const MAX_RELEVANT_HISTORY = 50;
const MAX_PATTERNS = 20;
const MAX_HISTORY_BRIEFINGS = 15;
const MAX_CORRELATIONS = 20;
const MAX_EMOTIONAL_FACTORS = 20;
const MAX_WHAT_WORKED = 20;
const MAX_ROOT_CAUSES = 20;

interface UseSessionAnalysisResult {
  analyzeWithCache: (
    title: string,
    context: string,
    knowledge: SessionKnowledge,
    trackerType: TrackerType,
    dietTargets?: { tdee: number; calories: number; protein: number; carbs: number; fat: number; goal: string; proteinPerKg: number; weightKg: number },
    gymWorkoutContext?: { workoutName: string; muscleGroups: string[]; exerciseNames: string[] }
  ) => Promise<{
    analysis: SessionAnalysis;
    fromCache: boolean;
    deltaApplied: boolean;
  } | null>;
  clearCache: (trackerType?: TrackerType) => void;
}

/**
 * Compute the analysis cache key.
 * For gym with workout context: "gym:Push Day:chest,shoulders"
 * For others or gym without context: just the tracker type
 */
function computeCacheKey(trackerType: TrackerType, workoutContextKey?: string): string {
  if (workoutContextKey) {
    return `${trackerType}:${workoutContextKey}`;
  }
  return trackerType;
}

/**
 * Find the best matching cache entry for the given tracker type.
 * Checks exact key first, then falls back to base tracker type key.
 */
function findCachedAnalysis(trackerType: TrackerType, cacheKey: string): CachedAnalysis | null {
  const store = useCacheStore.getState().analysisCache;
  // Exact match first
  if (store[cacheKey]) return store[cacheKey];
  // Fall back to base tracker type key (no workout context)
  if (cacheKey !== trackerType && store[trackerType]) return store[trackerType];
  return null;
}

/**
 * Check if cache should be invalidated
 */
function shouldInvalidateCache(
  cache: CachedAnalysis,
  currentBaselineHash: string | null,
  deltaEventCount: number
): { invalidate: boolean; reason: string } {
  // Schema changed — old cache has todaysPlan instead of historyBriefings
  if (!cache.analysis.historyBriefings) {
    return { invalidate: true, reason: 'analysis schema changed (missing historyBriefings)' };
  }

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

/**
 * Merge an AnalysisDelta into a cached SessionAnalysis.
 * Returns a new SessionAnalysis with the delta applied.
 *
 * Ordering: recent items first everywhere.
 * Deduplication: caps arrays to prevent unbounded growth.
 */
function mergeAnalysisDelta(cached: SessionAnalysis, delta: AnalysisDelta): SessionAnalysis {
  const merged = { ...cached };

  // --- relevantHistory: prepend new entries, sort by date DESC, cap ---
  const newHistory = [...delta.newHistoryEntries, ...cached.relevantHistory];
  newHistory.sort((a, b) => b.date.localeCompare(a.date));
  merged.relevantHistory = newHistory.slice(0, MAX_RELEVANT_HISTORY);

  // --- patterns: prepend new, apply updates, cap ---
  const updatedPatterns = [...cached.patterns];
  for (const update of delta.updatedPatterns) {
    const idx = updatedPatterns.findIndex((p) => p.name === update.name);
    if (idx >= 0) {
      const existing = updatedPatterns[idx];
      updatedPatterns[idx] = {
        ...existing,
        trend: update.trend ?? existing.trend,
        confidence: update.confidence ?? existing.confidence,
        evidence: update.newEvidence
          ? [...update.newEvidence, ...existing.evidence]
          : existing.evidence,
      };
    }
  }
  merged.patterns = [...delta.newPatterns, ...updatedPatterns].slice(0, MAX_PATTERNS);

  // --- correlations: prepend new, dedupe by factor (keep higher occurrences), cap ---
  const allCorrelations = [...delta.newCorrelations, ...cached.correlations];
  const correlationMap = new Map<string, typeof allCorrelations[0]>();
  for (const c of allCorrelations) {
    const existing = correlationMap.get(c.factor);
    if (!existing || c.occurrences > existing.occurrences) {
      correlationMap.set(c.factor, c);
    }
  }
  merged.correlations = Array.from(correlationMap.values()).slice(0, MAX_CORRELATIONS);

  // --- historyBriefings: prepend new, apply updates, cap ---
  const updatedBriefings = [...(cached.historyBriefings || [])];
  for (const update of delta.updatedHistoryBriefings) {
    const idx = updatedBriefings.findIndex((b) => b.label === update.label);
    if (idx >= 0) {
      const existing = updatedBriefings[idx];
      updatedBriefings[idx] = {
        ...existing,
        fullHistory: update.prependFullHistory
          ? `${update.prependFullHistory}\n${existing.fullHistory}`
          : existing.fullHistory,
        keyTakeaways: update.keyTakeaways ?? existing.keyTakeaways,
        linkedPatterns: union(existing.linkedPatterns, update.newLinkedPatterns || []),
        linkedInsights: union(existing.linkedInsights, update.newLinkedInsights || []),
      };
    }
  }
  merged.historyBriefings = [...delta.newHistoryBriefings, ...updatedBriefings].slice(
    0,
    MAX_HISTORY_BRIEFINGS
  );

  // --- coachBriefing: replace only provided (non-null) sub-fields ---
  if (cached.coachBriefing) {
    const updates = delta.coachBriefingUpdates;
    merged.coachBriefing = {
      userProfile: updates.userProfile ?? cached.coachBriefing.userProfile,
      whatGoesWrong: updates.whatGoesWrong ?? cached.coachBriefing.whatGoesWrong,
      whyItGoesWrong: updates.whyItGoesWrong ?? cached.coachBriefing.whyItGoesWrong,
      howWeFixedItBefore: updates.howWeFixedItBefore ?? cached.coachBriefing.howWeFixedItBefore,
      todaysRisks: updates.todaysRisks ?? cached.coachBriefing.todaysRisks,
      recommendedApproach: updates.recommendedApproach ?? cached.coachBriefing.recommendedApproach,
    };
  }

  // --- emotionalFactors: prepend new, sort by frequency DESC, cap ---
  const allEmotional = [...delta.newEmotionalFactors, ...(cached.emotionalFactors || [])];
  allEmotional.sort((a, b) => b.frequency - a.frequency);
  merged.emotionalFactors = allEmotional.slice(0, MAX_EMOTIONAL_FACTORS);

  // --- whatWorkedBefore: prepend new, sort by timesWorked DESC, cap ---
  const allWorked = [...delta.newWhatWorkedBefore, ...(cached.whatWorkedBefore || [])];
  allWorked.sort((a, b) => b.timesWorked - a.timesWorked);
  merged.whatWorkedBefore = allWorked.slice(0, MAX_WHAT_WORKED);

  // --- rootCauses: prepend new, cap ---
  merged.rootCauses = [...delta.newRootCauses, ...(cached.rootCauses || [])].slice(
    0,
    MAX_ROOT_CAUSES
  );

  // --- context: prepend new context ---
  if (delta.contextAppend) {
    merged.context = `${delta.contextAppend}\n${cached.context}`;
  }

  // --- generatedAt: now ---
  merged.generatedAt = new Date().toISOString();

  return merged;
}

/**
 * Set union of two string arrays (dedupe by string equality)
 */
function union(a: string[], b: string[]): string[] {
  const set = new Set([...a, ...b]);
  return Array.from(set);
}

export function useSessionAnalysisWithCache(): UseSessionAnalysisResult {
  // Use stable selectors that return functions, not state objects
  // This prevents the callback from being recreated when cache state changes
  const setAnalysisCache = useCacheStore((s) => s.setAnalysisCache);
  const clearAnalysisCache = useCacheStore((s) => s.clearAnalysisCache);

  // Track in-flight requests to prevent duplicates
  const inFlightRef = useRef<Set<string>>(new Set());

  const analyzeWithCache = useCallback(
    async (
      title: string,
      context: string,
      knowledge: SessionKnowledge,
      trackerType: TrackerType,
      dietTargets?: { tdee: number; calories: number; protein: number; carbs: number; fat: number; goal: string; proteinPerKg: number; weightKg: number },
      gymWorkoutContext?: { workoutName: string; muscleGroups: string[]; exerciseNames: string[] }
    ): Promise<{
      analysis: SessionAnalysis;
      fromCache: boolean;
      deltaApplied: boolean;
    } | null> => {
      // Compute a stable key for the current gym workout context
      const currentWorkoutKey = gymWorkoutContext
        ? `${gymWorkoutContext.workoutName}:${[...gymWorkoutContext.muscleGroups].sort().join(',')}`
        : undefined;

      const cacheKey = computeCacheKey(trackerType, currentWorkoutKey);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[ANALYSIS CACHE] Starting analysis for:', trackerType);
      console.log('[ANALYSIS CACHE] Cache key:', cacheKey);
      if (currentWorkoutKey) console.log('[ANALYSIS CACHE] Workout context key:', currentWorkoutKey);

      // Prevent duplicate requests (use trackerType to prevent any concurrent analysis for same tracker)
      if (inFlightRef.current.has(trackerType)) {
        console.log('[ANALYSIS CACHE] Request already in flight, skipping');
        return null;
      }

      inFlightRef.current.add(trackerType);

      try {
        // Check local cache - try exact key first, then base tracker type
        const cachedAnalysis = findCachedAnalysis(trackerType, cacheKey);
        console.log('[ANALYSIS CACHE] Local cache exists?', !!cachedAnalysis);

        if (cachedAnalysis) {
          // Check if this cache entry matches the workout context
          const cacheMatchesWorkout =
            currentWorkoutKey === undefined ||
            cachedAnalysis.workoutContextKey === currentWorkoutKey;

          console.log('[ANALYSIS CACHE] Found cache for:', trackerType);
          console.log('[ANALYSIS CACHE] Cache generated at:', cachedAnalysis.generatedAt);
          console.log('[ANALYSIS CACHE] Cache workout key:', cachedAnalysis.workoutContextKey);
          console.log('[ANALYSIS CACHE] Matches current workout?', cacheMatchesWorkout);
          console.log('[ANALYSIS CACHE] Cache has:', {
            sessionType: cachedAnalysis.analysis.sessionType,
            historyCount: cachedAnalysis.analysis.relevantHistory.length,
            patternsCount: cachedAnalysis.analysis.patterns.length,
            lastEventAt: cachedAnalysis.lastEventAt,
            eventCount: cachedAnalysis.eventCount,
          });

          // If workout context changed and we found no exact match, force full analysis
          if (!cacheMatchesWorkout) {
            console.log('[ANALYSIS CACHE] Workout context changed:', cachedAnalysis.workoutContextKey, '->', currentWorkoutKey);
            console.log('[ANALYSIS CACHE] No cached analysis for this workout, doing full analysis');
            // Fall through to full analysis
          } else {
            // Cache matches — proceed with delta check

            // Try to get current baseline hash
            let currentBaselineHash: string | null = null;
            try {
              currentBaselineHash = await getBaselineHash();
              console.log('[ANALYSIS CACHE] Current baseline hash:', currentBaselineHash?.slice(0, 8) || 'null');
            } catch {
              console.warn('[ANALYSIS CACHE] Could not fetch baseline hash, assuming unchanged');
              currentBaselineHash = cachedAnalysis.baselineHash;
            }
            console.log('[ANALYSIS CACHE] Cached baseline hash:', cachedAnalysis.baselineHash?.slice(0, 8) || 'null');

            // Try to fetch delta events
            let deltaResult: { events: { id: string; content: string; occurredAt: string; rawJson: unknown }[] } | null = null;
            try {
              console.log('[ANALYSIS CACHE] Fetching delta events since:', cachedAnalysis.lastEventAt);
              deltaResult = await fetchAnalysisDeltaEvents(
                trackerType,
                cachedAnalysis.lastEventAt
              );
            } catch {
              console.warn('[ANALYSIS CACHE] Delta fetch failed, returning cached analysis (offline-resilient)');
              return {
                analysis: cachedAnalysis.analysis,
                fromCache: true,
                deltaApplied: false,
              };
            }

            if (!deltaResult) {
              console.warn('[ANALYSIS CACHE] Delta fetch returned null, returning cached analysis (offline-resilient)');
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
              console.log('[ANALYSIS CACHE] Cache invalidated:', reason);
              // Fall through to full analysis
            } else if (deltaEventCount === 0) {
              // No new events - return cached analysis (no LLM call!)
              console.log('[ANALYSIS CACHE] CACHE HIT! No new events, returning cached analysis');
              console.log('[ANALYSIS CACHE] Saved ~$0.10-0.20 in LLM costs!');
              return {
                analysis: cachedAnalysis.analysis,
                fromCache: true,
                deltaApplied: false,
              };
            } else {
              // Delta update — LLM returns only new/changed items
              console.log('[ANALYSIS CACHE] Delta update with', deltaEventCount, 'events');
              console.log('[ANALYSIS CACHE] Using delta-only output (~$0.003) instead of full regen (~$0.15)');

              try {
                const summary = summarizeAnalysis(cachedAnalysis.analysis);
                const delta = await analyzeSessionDelta(
                  summary,
                  deltaResult.events,
                  trackerType
                );

                if (delta && !delta.hasChanges) {
                  console.log('[ANALYSIS CACHE] Delta returned hasChanges=false, returning cached');
                  return {
                    analysis: cachedAnalysis.analysis,
                    fromCache: true,
                    deltaApplied: false,
                  };
                }

                if (delta) {
                  const updatedAnalysis = mergeAnalysisDelta(cachedAnalysis.analysis, delta);
                  console.log('[ANALYSIS CACHE] Delta merge successful');

                  const lastEvent = deltaResult.events[deltaResult.events.length - 1];

                  const updatedCache: CachedAnalysis = {
                    analysis: updatedAnalysis,
                    lastEventId: lastEvent.id,
                    lastEventAt: lastEvent.occurredAt,
                    eventCount: cachedAnalysis.eventCount + deltaEventCount,
                    baselineHash: currentBaselineHash,
                    generatedAt: new Date().toISOString(),
                    workoutContextKey: currentWorkoutKey ?? cachedAnalysis.workoutContextKey,
                  };

                  setAnalysisCache(cacheKey, updatedCache);
                  console.log('[ANALYSIS CACHE] Cache updated with delta merge');

                  return {
                    analysis: updatedAnalysis,
                    fromCache: true,
                    deltaApplied: true,
                  };
                }
              } catch (deltaError) {
                console.warn('[ANALYSIS CACHE] Delta update failed, returning cached analysis');
                return {
                  analysis: cachedAnalysis.analysis,
                  fromCache: true,
                  deltaApplied: false,
                };
              }

              // Delta returned null - return cached
              console.warn('[ANALYSIS CACHE] Delta update returned null, returning cached analysis');
              return {
                analysis: cachedAnalysis.analysis,
                fromCache: true,
                deltaApplied: false,
              };
            }
          }
        }

        // Full analysis (no cache, cache invalidated, or workout context changed)
        console.log('[ANALYSIS CACHE] Doing FULL ANALYSIS for:', trackerType);
        console.log('[ANALYSIS CACHE] This will call gpt-4.1 (~$0.10-0.20)...');
        const analysis = await analyzeSession(title, context, knowledge, trackerType, dietTargets, gymWorkoutContext);

        if (!analysis) {
          console.error('[ANALYSIS CACHE] Full analysis failed');
          return null;
        }

        console.log('[ANALYSIS CACHE] Full analysis successful:', {
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

        // Save to cache using per-workout key
        const newCache: CachedAnalysis = {
          analysis,
          lastEventId: lastEvent?.id || null,
          lastEventAt: lastEvent?.occurredAt || null,
          eventCount: knowledge.events.length,
          baselineHash,
          generatedAt: new Date().toISOString(),
          workoutContextKey: currentWorkoutKey,
        };

        setAnalysisCache(cacheKey, newCache);
        console.log('[ANALYSIS CACHE] New cache saved for:', cacheKey);
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
        inFlightRef.current.delete(trackerType);
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
