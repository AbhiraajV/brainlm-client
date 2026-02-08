/**
 * Timeseries merge utility for diet stats correlation charts.
 * Forward-fills weight/bodyFat measurements to align with daily diet data.
 */

import type { DietStatDay } from '@/server/actions/diet-stats.actions';

export interface MergedDataPoint {
  date: string;            // YYYY-MM-DD
  dateLabel: string;       // MM-DD for chart axis
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  deficit: number;         // positive = under target
  weight?: number;         // forward-filled
  bodyFatPercent?: number;  // forward-filled
}

/**
 * Merge diet days with weight/bodyFat trend data using forward-fill.
 * For each diet day, picks the most recent weight/bodyFat measurement on or before that date.
 */
export function mergeTimeseriesData(
  dietDays: DietStatDay[],
  weightTrend: { date: string; weight: number }[],
  bodyFatTrend: { date: string; bodyFatPercent: number }[],
  targetCalories: number,
): MergedDataPoint[] {
  // Sort trends by date ascending for binary-search-style forward-fill
  const sortedWeight = [...weightTrend].sort((a, b) => a.date.localeCompare(b.date));
  const sortedBodyFat = [...bodyFatTrend].sort((a, b) => a.date.localeCompare(b.date));

  // Normalize trend dates to YYYY-MM-DD for comparison
  const normalizeDate = (d: string) => d.slice(0, 10);

  // Forward-fill: find latest entry <= target date
  function forwardFill<T extends { date: string }>(sorted: T[], targetDate: string): T | undefined {
    const target = normalizeDate(targetDate);
    let result: T | undefined;
    for (const entry of sorted) {
      if (normalizeDate(entry.date) <= target) {
        result = entry;
      } else {
        break;
      }
    }
    return result;
  }

  return dietDays
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => {
      const w = forwardFill(sortedWeight, day.date);
      const bf = forwardFill(sortedBodyFat, day.date);

      return {
        date: day.date,
        dateLabel: day.date.slice(5), // MM-DD
        calories: day.calories,
        protein: day.protein,
        carbs: day.carbs,
        fat: day.fat,
        deficit: targetCalories - day.calories,
        weight: w?.weight,
        bodyFatPercent: bf?.bodyFatPercent,
      };
    });
}
