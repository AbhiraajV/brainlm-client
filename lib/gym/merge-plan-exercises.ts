import { normalizeExerciseName } from './exercise-names';
import type { ExerciseLibraryEntry, WorkoutPlan, MuscleGroup, EquipmentType } from '@/lib/sessions/types';

interface PlanSource {
  planName: string;
  dayLabel: string;
  targetSets: number;
  targetReps: number;
  targetWeight?: number;
}

/**
 * Merge server-fetched exercise library entries with plan exercises from localStorage.
 * - Exercises in both → append planSources[]
 * - Exercises only in plans → stub ExerciseLibraryEntry with isPlanOnly: true
 * Result: performed exercises first (lastPerformed DESC), then plan-only (alphabetical)
 */
export function mergeLibraryWithPlans(
  serverEntries: ExerciseLibraryEntry[],
  plans: Record<string, WorkoutPlan>,
): ExerciseLibraryEntry[] {
  // Build lookup maps from server entries
  const byRegistryId = new Map<string, ExerciseLibraryEntry>();
  const byNormName = new Map<string, ExerciseLibraryEntry>();

  // Clone entries so we don't mutate the originals
  const merged = serverEntries.map((e) => ({ ...e, planSources: undefined as PlanSource[] | undefined }));

  for (const entry of merged) {
    if (entry.exerciseRegistryId) byRegistryId.set(entry.exerciseRegistryId, entry);
    byNormName.set(normalizeExerciseName(entry.exerciseName), entry);
  }

  // Collect plan-only exercises
  const planOnlyMap = new Map<string, { entry: ExerciseLibraryEntry; normKey: string }>();

  for (const plan of Object.values(plans)) {
    for (const day of plan.days) {
      if (day.isRestDay) continue;
      for (const ex of day.exercises) {
        const source: PlanSource = {
          planName: plan.name,
          dayLabel: day.dayLabel || day.name,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          targetWeight: ex.targetWeight,
        };

        // Try to match to existing entry
        let matched: ExerciseLibraryEntry | undefined;
        if (ex.exerciseRegistryId) matched = byRegistryId.get(ex.exerciseRegistryId);
        if (!matched) matched = byNormName.get(normalizeExerciseName(ex.exerciseName));

        if (matched) {
          // Append plan source to existing entry
          if (!matched.planSources) matched.planSources = [];
          matched.planSources.push(source);
        } else {
          // Plan-only: collect, dedup by registryId or normalized name
          const normKey = ex.exerciseRegistryId || normalizeExerciseName(ex.exerciseName);
          const existing = planOnlyMap.get(normKey);
          if (existing) {
            existing.entry.planSources!.push(source);
          } else {
            const stub: ExerciseLibraryEntry = {
              exerciseName: ex.exerciseName,
              exerciseRegistryId: ex.exerciseRegistryId,
              muscleGroup: ex.muscleGroup as MuscleGroup,
              secondaryMuscles: ex.secondaryMuscles,
              equipmentType: ex.equipmentType as EquipmentType,
              sessionCount: 0,
              totalLifetimeSets: 0,
              totalLifetimeReps: 0,
              totalLifetimeVolume: 0,
              prWeight: 0,
              prWeightDate: '',
              prE1RM: 0,
              prE1RMDate: '',
              prVolume: 0,
              prVolumeDate: '',
              lastPerformed: '',
              firstPerformed: '',
              avgDaysBetweenSessions: null,
              progressTrend: null,
              insights: [],
              sessions: [],
              planSources: [source],
              isPlanOnly: true,
            };
            planOnlyMap.set(normKey, { entry: stub, normKey });
          }
        }
      }
    }
  }

  // Append plan-only entries, sorted alphabetically
  const planOnlyEntries = Array.from(planOnlyMap.values())
    .map((v) => v.entry)
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

  return [...merged, ...planOnlyEntries];
}
