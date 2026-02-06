/**
 * Handler for remove_set tool
 * Removes a set from an exercise
 */

import type { WorkoutLog } from '@/lib/sessions/types';
import type { RemoveSetArgs } from '../gym-coach-tools';
import {
  calculateTotalVolume,
  calculateTotalReps,
  findBestE1RM,
  calculateAverageRPE
} from '@/lib/gym/formulas';

export interface RemoveSetResult {
  workout: WorkoutLog;
  removed: boolean;
}

/**
 * Recalculate workout summary based on all exercises
 */
function recalculateWorkoutSummary(workout: WorkoutLog): WorkoutLog {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let prCount = 0;
  const muscleGroupsWorked = new Set(workout.muscleGroups);

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
    muscleGroups: Array.from(muscleGroupsWorked),
    summary: {
      totalExercises: workout.exercises.length,
      totalSets,
      totalReps,
      totalVolume,
      totalVolumeUnit: workout.preferredUnit,
      muscleGroupsWorked: Array.from(muscleGroupsWorked),
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
 * Remove a set from an exercise
 */
export function handleRemoveSet(
  workout: WorkoutLog,
  args: RemoveSetArgs
): RemoveSetResult {
  const exerciseIndex = workout.exercises.findIndex(e => e.id === args.exerciseId);
  if (exerciseIndex === -1) {
    throw new Error(`Exercise not found: ${args.exerciseId}`);
  }

  const exercise = workout.exercises[exerciseIndex];
  const setIndex = args.setNumber - 1; // Convert to 0-indexed

  if (setIndex < 0 || setIndex >= exercise.sets.length) {
    throw new Error(`Set number ${args.setNumber} not found in exercise`);
  }

  // Remove the set
  const updatedSets = exercise.sets.filter((_, i) => i !== setIndex);

  // Renumber remaining sets
  const renumberedSets = updatedSets.map((set, i) => ({
    ...set,
    setNumber: i + 1
  }));

  // Recalculate exercise computed fields
  const updatedExercise = {
    ...exercise,
    sets: renumberedSets,
    computed: renumberedSets.length > 0
      ? {
          totalVolume: calculateTotalVolume(renumberedSets),
          totalReps: calculateTotalReps(renumberedSets),
          bestE1RM: findBestE1RM(renumberedSets)
        }
      : undefined
  };

  // Update workout
  const updatedExercises = [...workout.exercises];
  updatedExercises[exerciseIndex] = updatedExercise;

  // Also update session-level PRs to remove any PRs from this set
  const removedSet = exercise.sets[setIndex];
  let prsThisSession = workout.computed?.prsThisSession ?? [];
  if (removedSet.computed?.isPR) {
    prsThisSession = prsThisSession.filter(
      pr => !(pr.exerciseName === exercise.exerciseName && pr.newValue === removedSet.computed?.e1rm)
    );
  }

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
    removed: true
  };
}
