"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { JobType, JobStatus, TrackedType } from "@prisma/client";
import type { WorkoutLog, MuscleGroup } from "@/lib/sessions/types";
import { formatSessionContent, type SessionAnalysisInput } from "./session-format.utils";

/**
 * Workout Session Actions
 * Save and load workout sessions with full rawJson storage
 */

export interface SessionMeta {
  title: string;
  goal?: string;
  guide?: string;
  analysis?: SessionAnalysisInput;
}

export interface SaveWorkoutResult {
  eventId: string;
  jobId: string;
}

/**
 * Save a completed workout session to the database.
 * Creates an Event with rawJson (structured data) and content (rich markdown
 * in the format recognized by parseSessionLog in EventRow).
 */
export async function saveWorkoutSession(
  workout: WorkoutLog,
  events?: { content: string; llmComment?: string }[],
  sessionMeta?: SessionMeta,
): Promise<SaveWorkoutResult> {
  const user = await requireUser();

  // Build rich markdown content using the shared formatter
  const content = formatSessionContent({
    title: sessionMeta?.title || workout.workoutName || `Workout - ${workout.date}`,
    goal: sessionMeta?.goal,
    guide: sessionMeta?.guide || 'Gym Coach',
    events: events?.map(e => ({ content: e.content, llmComment: e.llmComment })),
    analysis: sessionMeta?.analysis,
  });

  // Create Event and WorkerJob atomically
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        userId: user.id,
        content,
        occurredAt: new Date(workout.date),
        rawJson: workout as object,
        trackedType: TrackedType.GYM,
      },
    });

    // Enqueue interpretation job
    const job = await tx.workerJob.create({
      data: {
        type: JobType.INTERPRET_EVENT,
        payload: { eventId: event.id, userId: user.id },
        status: JobStatus.PENDING,
        userId: user.id,
        idempotencyKey: `interpret:${event.id}`
      }
    });

    return { eventId: event.id, jobId: job.id };
  });

  return result;
}

/**
 * Load a workout session from a saved event
 */
export async function loadWorkoutSession(
  eventId: string
): Promise<WorkoutLog | null> {
  const user = await requireUser();

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      userId: user.id
      // trackedType filter available after migration
    }
  });

  if (!event) return null;

  // rawJson field available after migration
  const rawJson = (event as { rawJson?: unknown }).rawJson;
  if (!rawJson) return null;

  return rawJson as WorkoutLog;
}

/**
 * Get the most recent workout for a user
 * Note: After migration, this will filter by trackedType = GYM
 */
export async function getLatestWorkout(): Promise<WorkoutLog | null> {
  const user = await requireUser();

  // Use raw query to get event with rawJson after migration
  // For now, we just get the most recent event
  const event = await prisma.event.findFirst({
    where: {
      userId: user.id
      // trackedType: TrackedType.GYM - available after migration
    },
    orderBy: {
      occurredAt: 'desc'
    }
  });

  if (!event) return null;

  // rawJson field available after migration
  const rawJson = (event as { rawJson?: unknown }).rawJson;
  if (!rawJson) return null;

  return rawJson as WorkoutLog;
}

/**
 * Get the last workout for a specific muscle group
 */
export async function getLastWorkoutForMuscle(
  muscleGroup: MuscleGroup
): Promise<WorkoutLog | null> {
  const user = await requireUser();

  // Use raw query for JSONB containment check
  const results = await prisma.$queryRaw<Array<{
    id: string;
    rawJson: WorkoutLog;
  }>>`
    SELECT e."id", e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
      AND (
        e."rawJson"->'muscleGroups' ? ${muscleGroup}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(e."rawJson"->'exercises') as ex
          WHERE ex->>'muscleGroup' = ${muscleGroup}
        )
      )
    ORDER BY e."occurredAt" DESC
    LIMIT 1
  `;

  if (results.length === 0) return null;

  return results[0].rawJson;
}

/**
 * Update an existing workout session
 * Used when editing a past workout
 */
export async function updateWorkoutSession(
  eventId: string,
  workout: WorkoutLog
): Promise<{ success: boolean }> {
  const user = await requireUser();

  const content = formatSessionContent({
    title: workout.workoutName || `Workout - ${workout.date}`,
    guide: 'Gym Coach',
  });

  await prisma.event.update({
    where: {
      id: eventId,
      userId: user.id
    },
    data: {
      content,
      occurredAt: new Date(workout.date),
      rawJson: workout as object,
    } as Parameters<typeof prisma.event.update>[0]['data']
  });

  return { success: true };
}
