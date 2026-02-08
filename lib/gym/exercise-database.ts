/**
 * Global Exercise Database
 *
 * Loads 2909 exercises from the pre-built JSON and provides
 * normalized name lookup + token-based search.
 *
 * Server-only: Next.js tree-shakes this from client bundles
 * since it's only imported in server/ code.
 */

import exercisesJson from './exercise-database.json';
import { normalizeExerciseName } from './exercise-names';
import type { MuscleGroup, EquipmentType } from '@/lib/sessions/types';
import { getBroadGroup } from './muscle-groups';

export interface GlobalExercise {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  bodyPart: string;
  equipment: string;
  type: string;
  level: string;
}

export const GLOBAL_EXERCISES: GlobalExercise[] = exercisesJson as GlobalExercise[];

// Pre-built normalized name index (built once on import)
const nameIndex = new Map<string, GlobalExercise>();
// Also store pre-computed tokens for containment matching
const tokenIndex: { ex: GlobalExercise; tokens: string[]; normalized: string }[] = [];

for (const ex of GLOBAL_EXERCISES) {
  const normalized = normalizeExerciseName(ex.name);
  nameIndex.set(normalized, ex);
  tokenIndex.push({ ex, tokens: normalized.split(' '), normalized });
}

/**
 * Find an exercise by name.
 *
 * 1. Exact normalized match (fastest)
 * 2. Containment match: all DB-name tokens appear in the query,
 *    OR all query tokens appear in the DB name.
 *    Picks the best match by token overlap score.
 *
 * This handles cases like "Barbell Bench Press" matching "Bench press"
 * (the DB tokens "bench" and "press" both appear in the query).
 */
export function findExerciseByName(name: string): GlobalExercise | null {
  const normalized = normalizeExerciseName(name);

  // 1. Exact match
  const exact = nameIndex.get(normalized);
  if (exact) return exact;

  // 2. Containment match
  const queryTokens = normalized.split(' ');

  let bestMatch: GlobalExercise | null = null;
  let bestScore = 0;

  for (const entry of tokenIndex) {
    // Check: all DB tokens appear in query (DB is subset of query)
    const dbInQuery = entry.tokens.every((t) => queryTokens.includes(t));
    // Check: all query tokens appear in DB (query is subset of DB)
    const queryInDb = queryTokens.every((t) => entry.tokens.includes(t));

    if (dbInQuery || queryInDb) {
      // Score: number of overlapping tokens / max(lengths)
      // Prefer the most specific match (most token overlap)
      const overlap = entry.tokens.filter((t) => queryTokens.includes(t)).length;
      const maxLen = Math.max(entry.tokens.length, queryTokens.length);
      const score = overlap / maxLen;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry.ex;
      }
    }
  }

  // Only accept matches with at least 50% token overlap
  return bestScore >= 0.5 ? bestMatch : null;
}

/**
 * Find an exercise by its numeric global DB ID.
 */
export function findExerciseById(id: number): GlobalExercise | undefined {
  return GLOBAL_EXERCISES.find((ex) => ex.id === id);
}

/**
 * Search exercises by query tokens (for autocomplete).
 * All query tokens must appear somewhere in the normalized exercise name.
 * Optionally filter by muscle group (matches broad group).
 */
export function searchExercises(
  query: string,
  options?: { muscleGroup?: string; limit?: number }
): GlobalExercise[] {
  const limit = options?.limit ?? 20;
  const muscleFilter = options?.muscleGroup?.toLowerCase();

  // Pre-filter by muscle group if provided
  let candidates = GLOBAL_EXERCISES;
  if (muscleFilter) {
    candidates = candidates.filter((ex) => {
      const exBroad = getBroadGroup(ex.muscleGroup).toLowerCase();
      const exDirect = ex.muscleGroup.toLowerCase();
      return exDirect === muscleFilter || exBroad === muscleFilter;
    });
  }

  // If no query, just return top results from filtered set
  if (!query.trim()) {
    return candidates.slice(0, limit);
  }

  const tokens = normalizeExerciseName(query).split(' ');
  return candidates.filter((ex) => {
    const normalized = normalizeExerciseName(ex.name);
    return tokens.every((t) => normalized.includes(t));
  }).slice(0, limit);
}
