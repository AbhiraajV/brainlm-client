/**
 * Handler for remove_exercise tool
 * Removes an entire exercise from the workout
 */

import type { WorkoutLog } from '@/lib/sessions/types';
import type { RemoveExerciseArgs } from '../gym-coach-tools';
import {
  calculateTotalVolume,
  calculateTotalReps,
  calculateAverageRPE
} from '@/lib/gym/formulas';

export interface RemoveExerciseResult {
  workout: WorkoutLog;
  removed: boolean;
  exerciseName: string;
}

/**
 * Recalculate workout summary based on all exercises
 */
function recalculateWorkoutSummary(workout: WorkoutLog): WorkoutLog {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let prCount = 0;
  const muscleGroupsWorked = new Set<string>();

  for (const exercise of workout.exercises) {
    totalSets += exercise.sets.length;
    totalReps += calculateTotalReps(exercise.sets);
    totalVolume += calculateTotalVolume(exercise.sets);

    for (const set of exercise.sets) {
      if (set.computed?.isPR) {
        prCount++;
      }
    }

    muscleGroupsWorked.add(exercise.muscleGroup);
    if (exercise.secondaryMuscles) {
      exercise.secondaryMuscles.forEach(mg => muscleGroupsWorked.add(mg));
    }
  }

  return {
    ...workout,
    muscleGroups: Array.from(muscleGroupsWorked) as WorkoutLog['muscleGroups'],
    summary: {
      totalExercises: workout.exercises.length,
      totalSets,
      totalReps,
      totalVolume,
      totalVolumeUnit: workout.preferredUnit,
      muscleGroupsWorked: Array.from(muscleGroupsWorked) as WorkoutLog['muscleGroups'],
      prCount
    },
    computed: {
      ...workout.computed,
      totalVolume,
      totalTonnage: totalVolume,
      avgRPE: calculateAverageRPE(workout.exercises.flatMap(e => e.sets)),
      prsThisSession: workout.computed?.prsThisSession ?? []
    }
  };
}

/**
 * Remove an entire exercise from the workout
 */
export function handleRemoveExercise(
  workout: WorkoutLog,
  args: RemoveExerciseArgs
): RemoveExerciseResult {
  const exerciseIndex = workout.exercises.findIndex(e => e.id === args.exerciseId);
  if (exerciseIndex === -1) {
    throw new Error(`Exercise not found: ${args.exerciseId}`);
  }

  const removedExercise = workout.exercises[exerciseIndex];

  // Remove the exercise
  const updatedExercises = workout.exercises
    .filter((_, i) => i !== exerciseIndex)
    .map((ex, i) => ({
      ...ex,
      orderIndex: i
    }));

  // Remove any PRs from this exercise
  let prsThisSession = workout.computed?.prsThisSession ?? [];
  prsThisSession = prsThisSession.filter(
    pr => pr.exerciseName !== removedExercise.exerciseName
  );

  let updatedWorkout: WorkoutLog = {
    ...workout,
    exercises: updatedExercises,
    updatedAt: new Date().toISOString(),
    computed: {
      ...workout.computed,
      totalVolume: 0,
      totalTonnage: 0,
      prsThisSession
    }
  };

  // Recalculate workout summary
  updatedWorkout = recalculateWorkoutSummary(updatedWorkout);

  return {
    workout: updatedWorkout,
    removed: true,
    exerciseName: removedExercise.exerciseName
  };
}
