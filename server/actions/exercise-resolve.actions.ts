'use server';

import {
  findExerciseByName,
  searchExercises,
  type GlobalExercise,
} from '@/lib/gym/exercise-database';

/**
 * Search global exercises for autocomplete.
 * Used by the manual exercise picker UI.
 */
export async function searchGlobalExercises(
  query: string,
  limit?: number
): Promise<GlobalExercise[]> {
  return searchExercises(query, limit != null ? { limit } : undefined);
}

/**
 * Resolve a single exercise name against the global DB.
 * Returns the matching global exercise or null.
 * (Non-async — used directly in server code, not as a server action.)
 */
export async function resolveExercise(name: string): Promise<GlobalExercise | null> {
  return findExerciseByName(name);
}

/**
 * Resolve an array of exercise names (batch).
 * Used after LLM generation to resolve all exercises at once.
 * (Non-async — used directly in server code.)
 */
export async function resolveExerciseBatch(
  exercises: { exerciseName: string }[]
): Promise<(GlobalExercise | null)[]> {
  return exercises.map((ex) => findExerciseByName(ex.exerciseName));
}
