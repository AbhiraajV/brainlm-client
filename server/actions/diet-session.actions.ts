'use server';

import { prisma } from '@/server/prisma/client';
import { requireUser } from '@/server/auth';
import { TrackedType, JobType, JobStatus } from '@prisma/client';
import type { DietLog } from '@/lib/sessions/types';

/**
 * Format a diet log as human-readable text for the event content field
 */
function formatDietLogAsText(dietLog: DietLog): string {
  const lines: string[] = [`Diet Log - ${dietLog.date}`];

  for (const meal of dietLog.meals) {
    lines.push(`\n${meal.mealType.toUpperCase()}:`);
    for (const food of meal.foods) {
      lines.push(`  - ${food.name}: ${food.macros.calories}cal, ${food.macros.protein}g P`);
    }
  }

  const { totalMacros } = dietLog.summary;
  lines.push(`\nTotal: ${totalMacros.calories}cal, ${totalMacros.protein}g P, ${totalMacros.carbs}g C, ${totalMacros.fat}g F`);
  return lines.join('\n');
}

export interface SaveDietResult {
  eventId: string;
  jobId: string;
}

/**
 * Save a completed diet session to the database
 * Creates an Event with rawJson and enqueues for interpretation
 */
export async function saveDietSession(dietLog: DietLog): Promise<SaveDietResult> {
  const user = await requireUser();

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        userId: user.id,
        content: formatDietLogAsText(dietLog),
        occurredAt: new Date(dietLog.date),
        rawJson: dietLog as object,
        trackedType: TrackedType.DIET,
      },
    });

    const job = await tx.workerJob.create({
      data: {
        type: JobType.INTERPRET_EVENT,
        payload: { eventId: event.id, userId: user.id },
        status: JobStatus.PENDING,
        userId: user.id,
        idempotencyKey: `interpret:${event.id}`,
      },
    });

    return { eventId: event.id, jobId: job.id };
  });

  return result;
}
