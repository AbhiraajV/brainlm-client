import type {
  WorkoutTemplate, WorkoutLog, ExerciseEntry, ExerciseTargets,
  WorkoutPlan, PlanDay, MuscleGroup,
} from '@/lib/sessions/types';

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Creates a WorkoutLog from a WorkoutTemplate (legacy).
 */
export function workoutFromTemplate(template: WorkoutTemplate): WorkoutLog {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const exercises: ExerciseEntry[] = template.exercises.map((te) => {
    const targets: ExerciseTargets = {
      weight: te.targetWeight || 0,
      weightUnit: te.targetWeightUnit || 'kg',
      reps: te.targetReps,
      sets: te.targetSets,
      rationale: `From ${template.name} template`,
      confidence: 'high',
      source: 'history',
    };

    return {
      id: generateId(),
      exerciseName: te.exerciseName,
      muscleGroup: te.muscleGroup,
      secondaryMuscles: te.secondaryMuscles,
      equipmentType: te.equipmentType,
      sets: [],
      notes: te.notes,
      orderIndex: te.orderIndex,
      targets,
    };
  });

  return {
    id: generateId(),
    date: today,
    workoutName: template.name,
    templateId: template.id,
    templateName: template.name,
    muscleGroups: template.muscleGroups,
    exercises,
    summary: {
      totalExercises: exercises.length,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      totalVolumeUnit: 'kg',
      muscleGroupsWorked: template.muscleGroups,
      prCount: 0,
    },
    preferredUnit: 'kg',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates a WorkoutLog from a PlanDay within a WorkoutPlan.
 */
export function workoutFromPlanDay(plan: WorkoutPlan, day: PlanDay): WorkoutLog {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const exercises: ExerciseEntry[] = day.exercises.map((te) => {
    const targets: ExerciseTargets = {
      weight: te.targetWeight || 0,
      weightUnit: te.targetWeightUnit || 'kg',
      reps: te.targetReps,
      sets: te.targetSets,
      rationale: `From ${plan.name} - ${day.name}`,
      confidence: 'high',
      source: 'history',
    };

    return {
      id: generateId(),
      exerciseName: te.exerciseName,
      muscleGroup: te.muscleGroup,
      secondaryMuscles: te.secondaryMuscles,
      equipmentType: te.equipmentType,
      sets: [],
      notes: te.notes,
      orderIndex: te.orderIndex,
      targets,
    };
  });

  return {
    id: generateId(),
    date: today,
    workoutName: day.name,
    templateId: plan.id,
    templateName: `${plan.name} - ${day.name}`,
    muscleGroups: day.targetMuscles,
    exercises,
    summary: {
      totalExercises: exercises.length,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      totalVolumeUnit: 'kg',
      muscleGroupsWorked: day.targetMuscles,
      prCount: 0,
    },
    preferredUnit: 'kg',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Computes hits/week per muscle group from plan days' targetMuscles.
 */
export function computeMuscleFrequency(days: PlanDay[]): Record<string, number> {
  const freq: Partial<Record<MuscleGroup, number>> = {};
  for (const day of days) {
    if (day.isRestDay) continue;
    for (const mg of day.targetMuscles) {
      freq[mg] = (freq[mg] || 0) + 1;
    }
  }
  return freq as Record<string, number>;
}

/**
 * Estimates total workout duration based on exercises and sets.
 * ~2 minutes per set including rest.
 */
export function estimateWorkoutDuration(template: WorkoutTemplate): number {
  const totalSets = template.exercises.reduce((sum, e) => sum + e.targetSets, 0);
  return Math.round(totalSets * 2);
}
