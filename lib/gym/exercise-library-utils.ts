import type { ExerciseSessionSnapshot, WeightUnit } from '@/lib/sessions/types';

/**
 * Groups identical sets into compact display format.
 * e.g. "3x80kg x8, 1x85kg x6"
 */
export function formatSetsCompact(s: ExerciseSessionSnapshot): string {
  // Group sets by weight+reps
  const groups: { weight: number; unit: WeightUnit; reps: number; count: number }[] = [];

  for (const set of s.sets) {
    const last = groups[groups.length - 1];
    if (last && last.weight === set.weight && last.reps === set.reps && last.unit === set.weightUnit) {
      last.count++;
    } else {
      groups.push({ weight: set.weight, unit: set.weightUnit, reps: set.reps, count: 1 });
    }
  }

  return groups
    .map((g) => `${g.count}x${formatWeight(g.weight, g.unit)} x${g.reps}`)
    .join(', ');
}

/**
 * Format weight with unit: "80kg" or "175lbs"
 */
export function formatWeight(weight: number, unit: WeightUnit): string {
  if (weight === 0) return `0${unit}`;
  // Remove trailing zeros
  const formatted = Number.isInteger(weight) ? weight.toString() : weight.toFixed(1);
  return `${formatted}${unit}`;
}

/**
 * Relative date display: "2d ago", "1w ago", "3mo ago", "1y ago"
 */
export function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Trend direction arrow
 */
export function trendArrow(trend: 'up' | 'down' | 'flat' | null): string {
  switch (trend) {
    case 'up': return '\u2191';
    case 'down': return '\u2193';
    case 'flat': return '\u2192';
    default: return '';
  }
}
