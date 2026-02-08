'use server';

import { prisma } from '@/server/prisma/client';
import { requireUser } from '@/server/auth';
import { TrackedType, JobType, JobStatus } from '@prisma/client';
import type { DietLog } from '@/lib/sessions/types';
import { formatSessionContent, type SessionAnalysisInput } from './session-format.utils';

export interface SessionMeta {
  title: string;
  goal?: string;
  guide?: string;
  analysis?: SessionAnalysisInput;
}

export interface SaveDietResult {
  eventId: string;
  jobId: string;
}

/**
 * Save a completed diet session to the database.
 * Creates an Event with rawJson (structured data) and content (rich markdown
 * in the format recognized by parseSessionLog in EventRow).
 */
export async function saveDietSession(
  dietLog: DietLog,
  events?: { content: string; llmComment?: string }[],
  sessionMeta?: SessionMeta,
): Promise<SaveDietResult> {
  const user = await requireUser();

  // Build rich markdown content using the shared formatter
  const content = formatSessionContent({
    title: sessionMeta?.title || `Diet Log - ${dietLog.date}`,
    goal: sessionMeta?.goal,
    guide: sessionMeta?.guide || 'Nutrition Coach',
    events: events?.map(e => ({ content: e.content, llmComment: e.llmComment })),
    analysis: sessionMeta?.analysis,
  });

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        userId: user.id,
        content,
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
