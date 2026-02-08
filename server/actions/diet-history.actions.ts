'use server';

import { prisma } from '@/server/prisma/client';
import { requireUser } from '@/server/auth';
import { Prisma } from '@prisma/client';
import type { DietHistoryDay } from '@/lib/sessions/types';

/**
 * Fetch recent diet history from DB.
 * Queries the last N diet events with rawJson and extracts daily summaries.
 */
export async function fetchRecentDietHistory(
  days: number = 20
): Promise<DietHistoryDay[]> {
  const user = await requireUser();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  try {
    const dietEvents = await prisma.event.findMany({
      where: {
        userId: user.id,
        trackedType: 'DIET',
        occurredAt: { gte: cutoff },
        rawJson: { not: Prisma.DbNull },
      },
      select: {
        rawJson: true,
        occurredAt: true,
        content: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: days,
    });

    const result: DietHistoryDay[] = [];

    for (const event of dietEvents) {
      const json = event.rawJson as Record<string, unknown> | null;
      if (!json) continue;

      const summary = json.summary as Record<string, unknown> | undefined;
      const meals = json.meals as unknown[] | undefined;
      const totalMacros = summary?.totalMacros as Record<string, number> | undefined;

      if (!totalMacros || !totalMacros.calories) continue;

      const date = event.occurredAt
        ? new Date(event.occurredAt).toISOString().split('T')[0]
        : (json.date as string) || 'unknown';

      result.push({
        date,
        totalCalories: Math.round(totalMacros.calories || 0),
        totalProtein: Math.round(totalMacros.protein || 0),
        totalCarbs: Math.round(totalMacros.carbs || 0),
        totalFat: Math.round(totalMacros.fat || 0),
        totalFiber: summary?.totalFiber != null ? Math.round(summary.totalFiber as number) : undefined,
        mealCount: Array.isArray(meals) ? meals.length : (summary?.totalMeals as number) || 0,
        notes: event.content || undefined,
      });
    }

    return result;
  } catch (err) {
    // rawJson/trackedType columns may not exist yet if migration hasn't run
    console.error('[fetchRecentDietHistory] Error:', err);
    return [];
  }
}
