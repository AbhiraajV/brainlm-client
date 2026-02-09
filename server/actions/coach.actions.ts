'use server';

/**
 * Coach Server Action
 *
 * Thin wrapper around the coach agent for the coach chat tab.
 * The coach is read-only — no data mutation, just conversational advice.
 */

import { requireUser } from '@/server/auth';
import type {
  TrackerType,
  SessionAnalysis,
  MenstrualCycleInfo,
} from '@/lib/sessions/types';
import { executeCoach } from '@/server/agents/coach-agent';

export async function generateCoachResponse(
  trackerType: TrackerType,
  question: string,
  keyContext: string,
  previousCoachMessages: { role: 'user' | 'assistant'; content: string }[],
  analysis?: SessionAnalysis,
  currentSessionSummary?: string,
  cyclePhase?: MenstrualCycleInfo,
): Promise<{ comment: string } | { error: string }> {
  await requireUser();

  if (!question.trim()) {
    return { error: 'Empty question' };
  }

  try {
    const result = await executeCoach(
      trackerType,
      question,
      previousCoachMessages,
      keyContext,
      analysis,
      currentSessionSummary,
      cyclePhase,
    );

    if (result.error) {
      console.error('[generateCoachResponse] Error:', result.error);
    }

    return { comment: result.comment };
  } catch (error) {
    console.error('[generateCoachResponse] Error:', error);
    return { error: 'Failed to get coach response' };
  }
}
