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

interface SessionTotals {
  calories?: number;
  protein?: number;
  sets?: number;
  reps?: number;
  hours?: number;
}

/**
 * Extract cumulative totals from session events by parsing numeric values
 * Looks for common patterns: calories, protein, sets, reps, hours
 */
function extractSessionTotals(events: SessionEvent[], goal: string): SessionTotals {
  const totals: SessionTotals = {};
  const goalLower = goal.toLowerCase();

  // Determine what to track based on session goal
  const isDiet = goalLower.includes('diet') || goalLower.includes('cal') ||
                 goalLower.includes('food') || goalLower.includes('eat') ||
                 goalLower.includes('meal') || goalLower.includes('nutrition');
  const isWorkout = goalLower.includes('workout') || goalLower.includes('lift') ||
                    goalLower.includes('gym') || goalLower.includes('exercise') ||
                    goalLower.includes('training') || goalLower.includes('set');
  const isStudy = goalLower.includes('study') || goalLower.includes('focus') ||
                  goalLower.includes('learn') || goalLower.includes('read');

  for (const event of events) {
    const content = event.content.toLowerCase();

    // Extract calories (e.g., "350 cal", "350cal", "350 calories")
    if (isDiet) {
      const calMatch = content.match(/(\d+)\s*(?:cal|kcal|calories?)/i);
      if (calMatch) {
        totals.calories = (totals.calories || 0) + parseInt(calMatch[1], 10);
      }

      // Extract protein (e.g., "25g protein", "25 g protein", "protein: 25g")
      const proteinMatch = content.match(/(\d+)\s*g?\s*protein|protein[:\s]*(\d+)/i);
      if (proteinMatch) {
        const value = proteinMatch[1] || proteinMatch[2];
        totals.protein = (totals.protein || 0) + parseInt(value, 10);
      }
    }

    // Extract sets and reps (e.g., "3x8", "3 sets x 8 reps", "3 sets of 8")
    if (isWorkout) {
      // Pattern: "3x8" or "3 x 8"
      const setRepMatch = content.match(/(\d+)\s*x\s*(\d+)/i);
      if (setRepMatch) {
        const sets = parseInt(setRepMatch[1], 10);
        const repsPerSet = parseInt(setRepMatch[2], 10);
        totals.sets = (totals.sets || 0) + sets;
        totals.reps = (totals.reps || 0) + (sets * repsPerSet);
      } else {
        // Pattern: "3 sets" or "sets: 3"
        const setsMatch = content.match(/(\d+)\s*sets?|sets?[:\s]*(\d+)/i);
        if (setsMatch) {
          const value = setsMatch[1] || setsMatch[2];
          totals.sets = (totals.sets || 0) + parseInt(value, 10);
        }

        // Pattern: "8 reps" or "reps: 8"
        const repsMatch = content.match(/(\d+)\s*reps?|reps?[:\s]*(\d+)/i);
        if (repsMatch) {
          const value = repsMatch[1] || repsMatch[2];
          totals.reps = (totals.reps || 0) + parseInt(value, 10);
        }
      }
    }

    // Extract hours (e.g., "2 hrs", "2 hours", "2h")
    if (isStudy) {
      const hoursMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h\b)/i);
      if (hoursMatch) {
        totals.hours = (totals.hours || 0) + parseFloat(hoursMatch[1]);
      }

      // Pattern: "30 min" or "45 minutes" -> convert to hours
      const minsMatch = content.match(/(\d+)\s*(?:mins?|minutes?|m\b)/i);
      if (minsMatch) {
        totals.hours = (totals.hours || 0) + parseInt(minsMatch[1], 10) / 60;
      }
    }
  }

  // Round hours to 1 decimal
  if (totals.hours !== undefined) {
    totals.hours = Math.round(totals.hours * 10) / 10;
  }

  return totals;
}

/**
 * Format session totals as a readable string
 */
function formatTotalsSection(totals: SessionTotals): string | null {
  const parts: string[] = [];

  if (totals.calories !== undefined || totals.protein !== undefined) {
    const nutritionParts: string[] = [];
    if (totals.calories !== undefined) nutritionParts.push(`${totals.calories} cal`);
    if (totals.protein !== undefined) nutritionParts.push(`${totals.protein}g protein`);
    parts.push(`**Nutrition:** ${nutritionParts.join(' | ')}`);
  }

  if (totals.sets !== undefined || totals.reps !== undefined) {
    const workoutParts: string[] = [];
    if (totals.sets !== undefined) workoutParts.push(`${totals.sets} sets`);
    if (totals.reps !== undefined) workoutParts.push(`${totals.reps} total reps`);
    parts.push(`**Workout:** ${workoutParts.join(' | ')}`);
  }

  if (totals.hours !== undefined) {
    parts.push(`**Focus Time:** ${totals.hours} hrs`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
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

    // Session Totals section
    const totals = extractSessionTotals(input.events, input.sessionGoal || '');
    const totalsSection = formatTotalsSection(totals);
    if (totalsSection) {
      lines.push('');
      lines.push('## Session Totals');
      lines.push(totalsSection);
    }
  }

  return lines.join('\n');
}
