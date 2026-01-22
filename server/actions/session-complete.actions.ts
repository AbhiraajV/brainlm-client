'use server';

import { requireUser } from '@/server/auth';
import { prisma } from '@/server/prisma/client';

interface SessionEvent {
  content: string;
  createdAt: string;
  llmComment?: string;
}

interface CompleteSessionInput {
  sessionTitle: string;
  sessionGoal: string;
  guide?: string;
  events: SessionEvent[];
  coachBrief?: string;
}

export async function completeSession(
  input: CompleteSessionInput
): Promise<{ success: true; eventId: string } | { success: false; error: string }> {
  const user = await requireUser();

  // Format the event content
  const content = formatSessionSummary(input);

  try {
    const event = await prisma.event.create({
      data: {
        userId: user.id,
        content,
        occurredAt: new Date(),
      },
      select: { id: true },
    });

    return { success: true, eventId: event.id };
  } catch (error) {
    console.error('[completeSession] Error:', error);
    return { success: false, error: 'Failed to create event' };
  }
}

function formatSessionSummary(input: CompleteSessionInput): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${input.sessionTitle}`);
  lines.push('');

  // Goal
  if (input.sessionGoal) {
    lines.push(`**Goal:** ${input.sessionGoal}`);
    lines.push('');
  }

  // Guide (if available)
  if (input.guide) {
    lines.push(`**Coach:** ${input.guide}`);
    lines.push('');
  }

  // Events with coach tips
  if (input.events.length > 0) {
    lines.push('## Session Log');
    lines.push('');

    for (const event of input.events) {
      lines.push(`- ${event.content}`);
      if (event.llmComment) {
        lines.push(`  - _Coach: ${event.llmComment}_`);
      }
    }
  }

  return lines.join('\n');
}
