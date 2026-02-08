/**
 * Handler for update_exercise_notes tool
 * Updates qualitative notes on an exercise in the current workout.
 * These notes persist across sessions via rawJson → exercise library.
 */

import type { WorkoutLog } from '@/lib/sessions/types';
import type { UpdateExerciseNotesArgs } from '../gym-coach-tools';

export interface UpdateExerciseNotesResult {
  workout: WorkoutLog;
  updated: boolean;
}

/**
 * Update the notes field on an existing exercise in the workout.
 * Replaces the current notes entirely (coach decides what to keep/deprecate).
 */
export function handleUpdateExerciseNotes(
  workout: WorkoutLog,
  args: UpdateExerciseNotesArgs
): UpdateExerciseNotesResult {
  const idx = workout.exercises.findIndex(e => e.id === args.exerciseId);
  if (idx < 0) return { workout, updated: false };

  const exercises = [...workout.exercises];
  exercises[idx] = { ...exercises[idx], notes: args.notes };

  return {
    workout: { ...workout, exercises, updatedAt: new Date().toISOString() },
    updated: true,
  };
}
