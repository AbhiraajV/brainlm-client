"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { calculateE1RM } from "@/lib/gym/formulas";
import { getBroadGroup } from "@/lib/gym/muscle-groups";
import type {
  WorkoutLog,
  ExerciseLibraryEntry,
  ExerciseSessionSnapshot,
  ExerciseInsight,
  MuscleGroup,
  EquipmentType,
  FormQuality,
  SetType,
  WeightUnit,
} from "@/lib/sessions/types";

/**
 * Exercise Library Server Action
 *
 * Fetches all GYM events, groups by exercise, computes per-exercise
 * aggregates + auto-generated insights, returns rich ExerciseLibraryEntry objects.
 */

// ============================================================================
// KNOWN EXERCISES (lightweight list for agent context)
// ============================================================================

export interface KnownExercise {
  exerciseName: string;
  exerciseRegistryId?: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  sessionCount: number;
  lastPerformed: string; // ISO
}

/**
 * Get a lightweight list of the user's known exercises.
 * Used to give the gym coach agent awareness of what exercises exist.
 * Much lighter than getExerciseLibrary() — no sessions/sets/insights.
 */
export async function getKnownExercises(): Promise<KnownExercise[]> {
  const user = await requireUser();

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      occurredAt: Date;
      rawJson: WorkoutLog;
    }>
  >`
    SELECT e."id", e."occurredAt", e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
    ORDER BY e."occurredAt" DESC
  `;

  // Group by exercise, only extracting identity + count + last date
  const exerciseMap = new Map<string, KnownExercise>();

  for (const event of results) {
    const workout = event.rawJson;
    if (!workout?.exercises) continue;

    for (const exercise of workout.exercises) {
      const key =
        exercise.exerciseRegistryId ??
        exercise.exerciseName.toLowerCase();

      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, {
          exerciseName: exercise.exerciseName,
          exerciseRegistryId: exercise.exerciseRegistryId,
          muscleGroup: exercise.muscleGroup,
          equipmentType: exercise.equipmentType,
          sessionCount: 1,
          lastPerformed: event.occurredAt.toISOString(),
        });
      } else {
        exerciseMap.get(key)!.sessionCount++;
      }
    }
  }

  return Array.from(exerciseMap.values());
}

// ============================================================================
// INTERNAL: Exercise accumulator during grouping
// ============================================================================

interface ExerciseAccumulator {
  exerciseName: string;
  exerciseRegistryId?: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipmentType: EquipmentType;
  sessions: ExerciseSessionSnapshot[];
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getExerciseLibrary(): Promise<{
  exercises: ExerciseLibraryEntry[];
  fetchedAt: string;
}> {
  const user = await requireUser();

  // 1. Query all GYM events with rawJson, newest first
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      occurredAt: Date;
      rawJson: WorkoutLog;
    }>
  >`
    SELECT e."id", e."occurredAt", e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
    ORDER BY e."occurredAt" DESC
  `;

  // 2. Group by exercise
  const exerciseMap = new Map<string, ExerciseAccumulator>();

  for (const event of results) {
    const workout = event.rawJson;
    if (!workout?.exercises) continue;

    for (const exercise of workout.exercises) {
      const key =
        exercise.exerciseRegistryId ??
        exercise.exerciseName.toLowerCase();

      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, {
          exerciseName: exercise.exerciseName,
          exerciseRegistryId: exercise.exerciseRegistryId,
          muscleGroup: exercise.muscleGroup,
          secondaryMuscles: exercise.secondaryMuscles,
          equipmentType: exercise.equipmentType,
          sessions: [],
        });
      }

      const acc = exerciseMap.get(key)!;

      // Build session snapshot
      const sets = exercise.sets.map((s) => {
        const volume = s.weight * s.actualReps;
        const e1rm = calculateE1RM(s.weight, s.actualReps);
        return {
          setNumber: s.setNumber,
          setType: s.setType as SetType,
          weight: s.weight,
          weightUnit: s.weightUnit as WeightUnit,
          reps: s.actualReps,
          rpe: s.rpe,
          rir: s.rir,
          formQuality: s.formQuality as FormQuality | undefined,
          volume,
          e1rm,
          notes: s.notes,
        };
      });

      const sessionVolume = sets.reduce((sum, s) => sum + s.volume, 0);
      const topWeight = sets.length > 0 ? Math.max(...sets.map((s) => s.weight)) : 0;
      const topE1RM = sets.length > 0 ? Math.max(...sets.map((s) => s.e1rm)) : 0;
      const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);

      acc.sessions.push({
        eventId: event.id,
        date: event.occurredAt.toISOString(),
        workoutName: workout.workoutName,
        sets,
        sessionVolume,
        topWeight,
        topE1RM,
        totalReps,
        totalSets: sets.length,
        exerciseNotes: exercise.notes,
      });
    }
  }

  // 3. Compute lifetime aggregates & insights
  const exercises: ExerciseLibraryEntry[] = [];

  for (const acc of exerciseMap.values()) {
    const sessions = acc.sessions; // already newest-first from query order
    const sessionCount = sessions.length;
    if (sessionCount === 0) continue;

    // Lifetime aggregates
    let totalLifetimeSets = 0;
    let totalLifetimeReps = 0;
    let totalLifetimeVolume = 0;
    let prWeight = 0;
    let prWeightDate = '';
    let prE1RM = 0;
    let prE1RMDate = '';
    let prVolume = 0;
    let prVolumeDate = '';

    for (const s of sessions) {
      totalLifetimeSets += s.totalSets;
      totalLifetimeReps += s.totalReps;
      totalLifetimeVolume += s.sessionVolume;

      if (s.topWeight > prWeight) {
        prWeight = s.topWeight;
        prWeightDate = s.date;
      }
      if (s.topE1RM > prE1RM) {
        prE1RM = s.topE1RM;
        prE1RMDate = s.date;
      }
      if (s.sessionVolume > prVolume) {
        prVolume = s.sessionVolume;
        prVolumeDate = s.date;
      }
    }

    // Timeline
    const lastPerformed = sessions[0].date;
    const firstPerformed = sessions[sessions.length - 1].date;

    // Avg days between sessions
    let avgDaysBetweenSessions: number | null = null;
    if (sessionCount >= 2) {
      const firstMs = new Date(firstPerformed).getTime();
      const lastMs = new Date(lastPerformed).getTime();
      const totalDays = (lastMs - firstMs) / (1000 * 60 * 60 * 24);
      avgDaysBetweenSessions = Math.round((totalDays / (sessionCount - 1)) * 10) / 10;
    }

    // Progress trend: compare avg topE1RM of last 3 sessions vs previous 3
    let progressTrend: 'up' | 'down' | 'flat' | null = null;
    if (sessionCount >= 6) {
      const recent3 = sessions.slice(0, 3);
      const prev3 = sessions.slice(3, 6);
      const recentAvg = recent3.reduce((s, x) => s + x.topE1RM, 0) / 3;
      const prevAvg = prev3.reduce((s, x) => s + x.topE1RM, 0) / 3;
      const changePct = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;
      if (changePct > 3) progressTrend = 'up';
      else if (changePct < -3) progressTrend = 'down';
      else progressTrend = 'flat';
    } else if (sessionCount >= 3) {
      // With fewer sessions, just compare last vs first half
      const mid = Math.floor(sessionCount / 2);
      const recent = sessions.slice(0, mid);
      const older = sessions.slice(mid);
      const recentAvg = recent.reduce((s, x) => s + x.topE1RM, 0) / recent.length;
      const olderAvg = older.reduce((s, x) => s + x.topE1RM, 0) / older.length;
      const changePct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
      if (changePct > 5) progressTrend = 'up';
      else if (changePct < -5) progressTrend = 'down';
      else progressTrend = 'flat';
    }

    // Generate insights
    const insights = generateInsights(sessions, avgDaysBetweenSessions);

    exercises.push({
      exerciseName: acc.exerciseName,
      exerciseRegistryId: acc.exerciseRegistryId,
      muscleGroup: acc.muscleGroup,
      secondaryMuscles: acc.secondaryMuscles,
      equipmentType: acc.equipmentType,
      sessionCount,
      totalLifetimeSets,
      totalLifetimeReps,
      totalLifetimeVolume,
      prWeight,
      prWeightDate,
      prE1RM,
      prE1RMDate,
      prVolume,
      prVolumeDate,
      lastPerformed,
      firstPerformed,
      avgDaysBetweenSessions,
      progressTrend,
      insights,
      sessions,
    });
  }

  // 4. Sort by lastPerformed DESC
  exercises.sort(
    (a, b) => new Date(b.lastPerformed).getTime() - new Date(a.lastPerformed).getTime()
  );

  return { exercises, fetchedAt: new Date().toISOString() };
}

// ============================================================================
// INTERNAL: Insight generation (zero LLM, pure pattern matching)
// ============================================================================

function generateInsights(
  sessions: ExerciseSessionSnapshot[],
  avgDaysBetween: number | null
): ExerciseInsight[] {
  const insights: ExerciseInsight[] = [];
  const count = sessions.length;
  if (count < 2) return insights;

  // Progress insight: E1RM trending up
  if (count >= 4) {
    const recent3 = sessions.slice(0, 3);
    const prev = sessions.slice(3, Math.min(6, count));
    if (prev.length >= 2) {
      const recentAvg = recent3.reduce((s, x) => s + x.topE1RM, 0) / recent3.length;
      const prevAvg = prev.reduce((s, x) => s + x.topE1RM, 0) / prev.length;
      const changePct = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;
      if (changePct > 5) {
        insights.push({
          type: 'progress',
          message: `E1RM up ${Math.round(changePct)}% over last ${recent3.length} sessions`,
          severity: 'positive',
        });
      }
    }
  }

  // Plateau insight: same weight range for last 4+ sessions
  if (count >= 4) {
    const last4 = sessions.slice(0, 4);
    const weights = last4.map((s) => s.topWeight);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const variance = maxW > 0 ? ((maxW - minW) / maxW) * 100 : 0;
    if (variance < 5) {
      insights.push({
        type: 'plateau',
        message: `Same weight range for last ${last4.length} sessions`,
        severity: 'warning',
      });
    }
  }

  // Form insight: recent form quality declining
  if (count >= 3) {
    const recentForms = sessions
      .slice(0, 3)
      .flatMap((s) => s.sets.map((set) => set.formQuality))
      .filter(Boolean) as FormQuality[];
    const olderForms = sessions
      .slice(3, 6)
      .flatMap((s) => s.sets.map((set) => set.formQuality))
      .filter(Boolean) as FormQuality[];

    if (recentForms.length >= 2 && olderForms.length >= 2) {
      const formScore = (f: FormQuality) =>
        f === 'excellent' ? 4 : f === 'good' ? 3 : f === 'moderate' ? 2 : 1;
      const recentAvg = recentForms.reduce((s, f) => s + formScore(f), 0) / recentForms.length;
      const olderAvg = olderForms.reduce((s, f) => s + formScore(f), 0) / olderForms.length;
      if (recentAvg < olderAvg - 0.5) {
        insights.push({
          type: 'form',
          message: 'Form declined in recent sessions',
          severity: 'warning',
        });
      }
    }
  }

  // Volume insight: session volume trend over last 5
  if (count >= 5) {
    const last5 = sessions.slice(0, 5);
    const first = last5[last5.length - 1].sessionVolume;
    const latest = last5[0].sessionVolume;
    if (first > 0) {
      const volChange = ((latest - first) / first) * 100;
      if (volChange > 15) {
        insights.push({
          type: 'volume',
          message: `Volume up ${Math.round(volChange)}% over last 5 sessions`,
          severity: 'positive',
        });
      } else if (volChange < -15) {
        insights.push({
          type: 'volume',
          message: `Volume down ${Math.round(Math.abs(volChange))}% over last 5 sessions`,
          severity: 'warning',
        });
      }
    }
  }

  // Frequency insight
  if (avgDaysBetween !== null && avgDaysBetween > 0) {
    const lastPerformed = new Date(sessions[0].date);
    const daysSinceLast = Math.floor(
      (Date.now() - lastPerformed.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLast > avgDaysBetween * 2 && daysSinceLast > 7) {
      insights.push({
        type: 'frequency',
        message: `Last performed ${daysSinceLast}d ago (avg every ${Math.round(avgDaysBetween)}d)`,
        severity: 'warning',
      });
    }
  }

  return insights;
}

// ============================================================================
// COACH-FILTERED EXERCISE LIBRARY (lightweight summaries for agent context)
// ============================================================================

export interface ExerciseLibrarySummary {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  sessionCount: number;
  prWeight: number;
  prWeightDate: string;
  prE1RM: number;
  prE1RMDate: string;
  progressTrend: 'up' | 'down' | 'flat' | null;
  insights: { type: string; message: string; severity: string }[];
  recentSessions: string; // pre-formatted: "Feb 5: 80kg x 8,8,6 | Feb 1: 77.5kg x 8,8,8"
  notes: string[]; // exercise-level notes from recent sessions
}

/**
 * Get exercise library data filtered to a set of (already expanded) muscle groups.
 * Returns condensed summaries suitable for injection into the coach system prompt.
 */
export async function getExerciseLibraryForCoach(
  targetMuscleGroups: MuscleGroup[]
): Promise<ExerciseLibrarySummary[]> {
  const user = await requireUser();

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      occurredAt: Date;
      rawJson: WorkoutLog;
    }>
  >`
    SELECT e."id", e."occurredAt", e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
    ORDER BY e."occurredAt" DESC
  `;

  const targetSet = new Set<MuscleGroup>(targetMuscleGroups);

  // Group by exercise, filtering by target muscles
  const exerciseMap = new Map<string, {
    exerciseName: string;
    muscleGroup: MuscleGroup;
    equipmentType: EquipmentType;
    sessions: ExerciseSessionSnapshot[];
  }>();

  for (const event of results) {
    const workout = event.rawJson;
    if (!workout?.exercises) continue;

    for (const exercise of workout.exercises) {
      const broad = getBroadGroup(exercise.muscleGroup);
      if (!targetSet.has(broad) && !targetSet.has(exercise.muscleGroup)) continue;

      const key =
        exercise.exerciseRegistryId ??
        exercise.exerciseName.toLowerCase();

      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, {
          exerciseName: exercise.exerciseName,
          muscleGroup: exercise.muscleGroup,
          equipmentType: exercise.equipmentType,
          sessions: [],
        });
      }

      const acc = exerciseMap.get(key)!;

      const sets = exercise.sets.map((s) => {
        const volume = s.weight * s.actualReps;
        const e1rm = calculateE1RM(s.weight, s.actualReps);
        return {
          setNumber: s.setNumber,
          setType: s.setType as SetType,
          weight: s.weight,
          weightUnit: s.weightUnit as WeightUnit,
          reps: s.actualReps,
          rpe: s.rpe,
          rir: s.rir,
          formQuality: s.formQuality as FormQuality | undefined,
          volume,
          e1rm,
          notes: s.notes,
        };
      });

      const sessionVolume = sets.reduce((sum, s) => sum + s.volume, 0);
      const topWeight = sets.length > 0 ? Math.max(...sets.map((s) => s.weight)) : 0;
      const topE1RM = sets.length > 0 ? Math.max(...sets.map((s) => s.e1rm)) : 0;
      const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);

      acc.sessions.push({
        eventId: event.id,
        date: event.occurredAt.toISOString(),
        workoutName: workout.workoutName,
        sets,
        sessionVolume,
        topWeight,
        topE1RM,
        totalReps,
        totalSets: sets.length,
        exerciseNotes: exercise.notes,
      });
    }
  }

  // Build summaries
  const summaries: ExerciseLibrarySummary[] = [];

  for (const acc of exerciseMap.values()) {
    const sessions = acc.sessions;
    const sessionCount = sessions.length;
    if (sessionCount === 0) continue;

    // PRs
    let prWeight = 0, prWeightDate = '';
    let prE1RM = 0, prE1RMDate = '';
    for (const s of sessions) {
      if (s.topWeight > prWeight) { prWeight = s.topWeight; prWeightDate = s.date; }
      if (s.topE1RM > prE1RM) { prE1RM = s.topE1RM; prE1RMDate = s.date; }
    }

    // Progress trend
    let progressTrend: 'up' | 'down' | 'flat' | null = null;
    if (sessionCount >= 6) {
      const recent3 = sessions.slice(0, 3);
      const prev3 = sessions.slice(3, 6);
      const recentAvg = recent3.reduce((s, x) => s + x.topE1RM, 0) / 3;
      const prevAvg = prev3.reduce((s, x) => s + x.topE1RM, 0) / 3;
      const changePct = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;
      if (changePct > 3) progressTrend = 'up';
      else if (changePct < -3) progressTrend = 'down';
      else progressTrend = 'flat';
    } else if (sessionCount >= 3) {
      const mid = Math.floor(sessionCount / 2);
      const recent = sessions.slice(0, mid);
      const older = sessions.slice(mid);
      const recentAvg = recent.reduce((s, x) => s + x.topE1RM, 0) / recent.length;
      const olderAvg = older.reduce((s, x) => s + x.topE1RM, 0) / older.length;
      const changePct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
      if (changePct > 5) progressTrend = 'up';
      else if (changePct < -5) progressTrend = 'down';
      else progressTrend = 'flat';
    }

    // Avg days between sessions (for insights)
    let avgDaysBetween: number | null = null;
    if (sessionCount >= 2) {
      const firstMs = new Date(sessions[sessions.length - 1].date).getTime();
      const lastMs = new Date(sessions[0].date).getTime();
      const totalDays = (lastMs - firstMs) / (1000 * 60 * 60 * 24);
      avgDaysBetween = Math.round((totalDays / (sessionCount - 1)) * 10) / 10;
    }

    const insights = generateInsights(sessions, avgDaysBetween);

    // Format recent sessions (last 3) as compact string
    const recentSessions = sessions.slice(0, 3).map(s => {
      const dateStr = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const unit = s.sets[0]?.weightUnit || 'kg';
      const setsStr = s.sets
        .map(set => `${set.weight}${unit} x ${set.reps}`)
        .join(', ');
      return `${dateStr}: ${setsStr}`;
    }).join(' | ');

    // Collect exercise notes from recent sessions
    const notes: string[] = [];
    for (const s of sessions.slice(0, 5)) {
      if (s.exerciseNotes) notes.push(s.exerciseNotes);
    }

    summaries.push({
      exerciseName: acc.exerciseName,
      muscleGroup: acc.muscleGroup,
      equipmentType: acc.equipmentType,
      sessionCount,
      prWeight,
      prWeightDate,
      prE1RM,
      prE1RMDate,
      progressTrend,
      insights,
      recentSessions,
      notes: [...new Set(notes)], // deduplicate
    });
  }

  // Sort by session count DESC (most practiced first)
  summaries.sort((a, b) => b.sessionCount - a.sessionCount);

  return summaries;
}
