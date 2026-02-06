/**
 * Habit tracking utility functions
 */

import type {
  HabitDefinition,
  HabitLog,
  HabitEntry,
  HabitDaySummary,
} from '@/lib/sessions/types';

/**
 * Create an empty habit log from active habit definitions
 */
export function createEmptyHabitLog(habits: HabitDefinition[]): HabitLog {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const entries: HabitEntry[] = habits.map((h) => ({
    habitId: h.id,
    habitName: h.name,
    polarity: h.polarity,
    status: 'pending' as const,
  }));

  const log: HabitLog = {
    id: `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    date: today,
    entries,
    summary: calculateSummary(entries),
    createdAt: now,
    updatedAt: now,
  };

  return log;
}

/**
 * Calculate summary from entries
 */
function calculateSummary(entries: HabitEntry[]): HabitDaySummary {
  const positives = entries.filter((e) => e.polarity === 'positive');
  const negatives = entries.filter((e) => e.polarity === 'negative');

  const completedHabits = positives.filter((e) => e.status === 'done').length;
  const failedAntiHabits = negatives.filter((e) => e.status === 'done').length;
  const skippedCount = entries.filter((e) => e.status === 'skipped').length;

  // Success = positive done + negative NOT done (pending)
  const successCount = completedHabits + negatives.filter((e) => e.status === 'pending').length;
  const totalActionable = entries.length - skippedCount;
  const completionRate = totalActionable > 0 ? Math.round((successCount / totalActionable) * 100) : 0;

  const allPositivesDone = positives.length > 0 && positives.every((e) => e.status === 'done');

  return {
    totalHabits: positives.length,
    totalAntiHabits: negatives.length,
    completedHabits,
    failedAntiHabits,
    skippedCount,
    completionRate,
    allPositivesDone,
  };
}

/**
 * Recalculate summary from entries and return updated log
 */
export function recalculateSummary(log: HabitLog): HabitLog {
  return {
    ...log,
    summary: calculateSummary(log.entries),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if an entry represents a success
 * - Positive habits: done = success
 * - Negative habits (anti-habits): pending (not done) = success
 */
export function isHabitSuccessful(entry: HabitEntry): boolean {
  if (entry.polarity === 'positive') {
    return entry.status === 'done';
  }
  // Anti-habit: success means they didn't do the bad thing
  return entry.status === 'pending';
}

/**
 * Calculate current and best streaks for a habit
 */
export function calculateStreak(
  days: { date: string; entries: { habitId: string; status: string; polarity: string }[] }[],
  habitId: string
): { current: number; best: number } {
  if (days.length === 0) return { current: 0, best: 0 };

  // Sort by date descending (most recent first)
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));

  let current = 0;
  let best = 0;
  let streak = 0;
  let foundFirst = false;

  for (const day of sorted) {
    const entry = day.entries.find((e) => e.habitId === habitId);
    if (!entry) {
      // No entry for this day - break streak
      if (foundFirst) {
        best = Math.max(best, streak);
        streak = 0;
      }
      continue;
    }

    const success =
      entry.polarity === 'positive'
        ? entry.status === 'done'
        : entry.status === 'pending'; // Anti-habit: pending = didn't do bad thing

    if (success) {
      streak++;
      foundFirst = true;
    } else {
      if (foundFirst) {
        best = Math.max(best, streak);
        streak = 0;
      }
    }
  }

  best = Math.max(best, streak);
  // Current streak is from most recent day backwards
  current = 0;
  for (const day of sorted) {
    const entry = day.entries.find((e) => e.habitId === habitId);
    if (!entry) break;

    const success =
      entry.polarity === 'positive'
        ? entry.status === 'done'
        : entry.status === 'pending';

    if (success) {
      current++;
    } else {
      break;
    }
  }

  return { current, best };
}

/**
 * Format habit log as human-readable text for event content.
 * Groups entries by outcome so the worker LLM clearly sees pass/fail.
 */
export function formatHabitLogAsText(log: HabitLog): string {
  const lines: string[] = [];

  lines.push(`# Habit Tracker - ${log.date}`);
  lines.push('');

  const positives = log.entries.filter((e) => e.polarity === 'positive');
  const negatives = log.entries.filter((e) => e.polarity === 'negative');

  // Positive habits — split by outcome
  const completed = positives.filter((e) => e.status === 'done');
  const missed = positives.filter((e) => e.status === 'pending');
  const skippedPositive = positives.filter((e) => e.status === 'skipped');

  if (completed.length > 0) {
    lines.push('## Completed');
    for (const entry of completed) {
      lines.push(`- ${entry.habitName} ✓`);
      if (entry.comment) lines.push(`  > ${entry.comment}`);
    }
    lines.push('');
  }

  if (missed.length > 0) {
    lines.push('## Missed');
    for (const entry of missed) {
      lines.push(`- ${entry.habitName} ✗`);
      if (entry.comment) lines.push(`  > ${entry.comment}`);
    }
    lines.push('');
  }

  if (skippedPositive.length > 0) {
    lines.push('## Skipped');
    for (const entry of skippedPositive) {
      lines.push(`- ${entry.habitName}`);
      if (entry.comment) lines.push(`  > ${entry.comment}`);
    }
    lines.push('');
  }

  // Anti-habits — split by outcome
  const maintained = negatives.filter((e) => e.status === 'pending');
  const slipped = negatives.filter((e) => e.status === 'done');
  const skippedNegative = negatives.filter((e) => e.status === 'skipped');

  if (maintained.length > 0) {
    lines.push('## Anti-Habits Maintained');
    for (const entry of maintained) {
      lines.push(`- ${entry.habitName} — Clean`);
      if (entry.comment) lines.push(`  > ${entry.comment}`);
    }
    lines.push('');
  }

  if (slipped.length > 0) {
    lines.push('## Anti-Habits Slipped');
    for (const entry of slipped) {
      lines.push(`- ${entry.habitName} ✗`);
      if (entry.comment) lines.push(`  > ${entry.comment}`);
    }
    lines.push('');
  }

  if (skippedNegative.length > 0) {
    lines.push('## Anti-Habits Skipped');
    for (const entry of skippedNegative) {
      lines.push(`- ${entry.habitName}`);
      if (entry.comment) lines.push(`  > ${entry.comment}`);
    }
    lines.push('');
  }

  // Single-line summary
  lines.push('---');
  lines.push(
    `Summary: ${log.summary.completedHabits}/${log.summary.totalHabits} habits done, ` +
    `${log.summary.failedAntiHabits}/${log.summary.totalAntiHabits} anti-habits triggered, ` +
    `${log.summary.completionRate}% success rate`
  );

  if (log.notes) {
    lines.push('');
    lines.push('### Notes');
    lines.push(log.notes);
  }

  return lines.join('\n');
}
