/**
 * Handler for update_workout_notes tool
 * Updates workout-level notes, name, and rating
 */

import type { WorkoutLog } from '@/lib/sessions/types';
import type { UpdateWorkoutNotesArgs } from '../gym-coach-tools';

export interface UpdateWorkoutResult {
  workout: WorkoutLog;
  updated: boolean;
}

/**
 * Update workout-level properties (name, notes, rating)
 */
export function handleUpdateWorkout(
  workout: WorkoutLog,
  args: UpdateWorkoutNotesArgs
): UpdateWorkoutResult {
  const updatedWorkout: WorkoutLog = {
    ...workout,
    workoutName: args.workoutName ?? workout.workoutName,
    notes: args.notes ?? workout.notes,
    workoutRating: args.workoutRating ?? workout.workoutRating,
    updatedAt: new Date().toISOString()
  };

  return {
    workout: updatedWorkout,
    updated: true
  };
}
