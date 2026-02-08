import { useExercisesStore } from '@/store/exercises.store';
import { getExerciseTargetsForDay } from '@/server/actions/gym-history.actions';
import { workoutFromPlanDay } from '@/lib/templates/utils';
import { getBroadGroup } from '@/lib/gym/muscle-groups';
import type { WorkoutLog, WorkoutPlan, PlanDay } from '@/lib/sessions/types';
import type { WorkoutSummary } from '@/server/actions/gym-history.actions';

/**
 * Predict which plan day the user should train next.
 * Tries exact plan match first, then falls back to muscle group overlap
 * so freeform sessions are also recognized in the rotation.
 */
export function predictNextPlanDay(
  plan: WorkoutPlan,
  recentWorkouts: WorkoutSummary[],
): PlanDay | undefined {
  const trainingDays = plan.days
    .filter((d) => !d.isRestDay)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (trainingDays.length === 0) return undefined;
  if (recentWorkouts.length === 0) return trainingDays[0];

  // Strategy 1: Match by templateDayId or templateId+workoutName (exact plan match)
  for (const w of recentWorkouts) {
    let matchedIndex = -1;

    if (w.templateDayId) {
      matchedIndex = trainingDays.findIndex((d) => d.id === w.templateDayId);
    }
    if (matchedIndex === -1 && w.templateId === plan.id && w.workoutName) {
      matchedIndex = trainingDays.findIndex(
        (d) => d.name.toLowerCase() === w.workoutName!.toLowerCase(),
      );
    }

    if (matchedIndex !== -1) {
      return trainingDays[(matchedIndex + 1) % trainingDays.length];
    }
  }

  // Strategy 2: Match by muscle group overlap (handles freeform sessions)
  const dayBroadMuscles = trainingDays.map(
    (d) => new Set(d.targetMuscles.map(getBroadGroup)),
  );

  for (const w of recentWorkouts) {
    if (w.muscleGroups.length === 0) continue;
    const workoutBroad = new Set(w.muscleGroups.map(getBroadGroup));

    let bestDayIndex = -1;
    let bestOverlap = 0;

    for (let i = 0; i < trainingDays.length; i++) {
      const overlap = [...workoutBroad].filter((mg) => dayBroadMuscles[i].has(mg)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestDayIndex = i;
      }
    }

    if (bestDayIndex !== -1 && bestOverlap > 0) {
      return trainingDays[(bestDayIndex + 1) % trainingDays.length];
    }
  }

  // No match at all — default to first day
  return trainingDays[0];
}

/** Find when a plan day was last done from recent workout history */
export function getLastDoneDate(
  day: PlanDay,
  planId: string,
  recentWorkouts: WorkoutSummary[],
): string | null {
  const match = recentWorkouts.find((w) => {
    if (w.templateDayId === day.id) return true;
    if (w.templateId === planId && w.workoutName?.toLowerCase() === day.name.toLowerCase())
      return true;
    return false;
  });
  if (!match) return null;
  const d = new Date(match.date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Full pipeline to resolve a plan day into a ready-to-use WorkoutLog:
 * 1. Resolve exercises through exercise registry
 * 2. Fetch progressive overload targets
 * 3. Create WorkoutLog via workoutFromPlanDay()
 * 4. Overlay targets onto exercises
 */
export async function resolvePlanDayToWorkoutLog(
  plan: WorkoutPlan,
  day: PlanDay,
): Promise<WorkoutLog> {
  const registry = useExercisesStore.getState();
  const resolvedDay = {
    ...day,
    exercises: day.exercises.map((ex) => {
      const def = registry.resolveExercise(ex.exerciseName, ex.muscleGroup, ex.equipmentType);
      return { ...ex, exerciseRegistryId: def.id };
    }),
  };

  const targets = await getExerciseTargetsForDay(
    resolvedDay.exercises.map((ex) => ({
      name: ex.exerciseName,
      registryId: ex.exerciseRegistryId,
    })),
  );

  const workoutLog = workoutFromPlanDay(plan, resolvedDay);

  for (const ex of workoutLog.exercises) {
    const target = targets.find(
      (t) => t.exerciseName.toLowerCase() === ex.exerciseName.toLowerCase(),
    );
    if (!target) continue;

    if (target.lastSession) {
      ex.computed = {
        ...ex.computed,
        totalVolume: 0,
        totalReps: 0,
        bestE1RM: 0,
        lastSession: {
          date: target.lastSession.date,
          topSet: target.lastSession.sets.reduce(
            (best, s) => (s.weight > best.weight ? s : best),
            target.lastSession.sets[0] || { weight: 0, reps: 0 },
          ),
        },
      };
    }

    if (target.suggestedTargets && ex.targets) {
      ex.targets = {
        ...ex.targets,
        weight: target.suggestedTargets.weight,
        weightUnit: target.suggestedTargets.weightUnit,
        reps: target.suggestedTargets.reps,
        sets: target.suggestedTargets.sets,
        rationale: target.suggestedTargets.rationale,
        confidence: target.suggestedTargets.confidence,
        source: target.suggestedTargets.source as 'history' | 'correlation' | 'estimation',
      };
    }
  }

  return workoutLog;
}
