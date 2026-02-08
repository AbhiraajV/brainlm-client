'use server';

import { prisma } from '@/server/prisma/client';
import { requireUser } from '@/server/auth';
import { Prisma } from '@prisma/client';

export interface DietStatDay {
  date: string;       // YYYY-MM-DD
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  mealCount: number;
  notes?: string;
  fetchedAt: string;   // ISO timestamp for delta tracking
}

/**
 * Fetch all diet events (rawJson only). Used for initial cache load.
 */
export async function fetchAllDietStats(): Promise<DietStatDay[]> {
  const user = await requireUser();

  try {
    // Also count total DIET events (with or without rawJson) for debugging
    const totalDietCount = await prisma.event.count({
      where: { userId: user.id, trackedType: 'DIET' },
    });

    const events = await prisma.event.findMany({
      where: {
        userId: user.id,
        trackedType: 'DIET',
        rawJson: { not: Prisma.DbNull },
      },
      select: {
        id: true,
        rawJson: true,
        occurredAt: true,
        content: true,
        createdAt: true,
      },
      orderBy: { occurredAt: 'desc' },
    });

    console.log(`[fetchAllDietStats] totalDietEvents=${totalDietCount}, withRawJson=${events.length}`);

    const parsed: DietStatDay[] = [];
    for (const e of events) {
      const result = parseEvent(e);
      if (!result) {
        const json = e.rawJson as Record<string, unknown> | null;
        console.log(`[fetchAllDietStats] SKIPPED event id=${e.id}, occurredAt=${e.occurredAt?.toISOString()}, rawJson keys=${json ? Object.keys(json).join(',') : 'null'}, summary keys=${json?.summary ? Object.keys(json.summary as object).join(',') : 'none'}, totalMacros=${JSON.stringify((json?.summary as Record<string, unknown>)?.totalMacros ?? 'missing')}`);
      } else {
        parsed.push(result);
      }
    }

    console.log(`[fetchAllDietStats] parsed=${parsed.length}, dates=${parsed.map(p => p.date).join(',')}`);
    return aggregateByDate(parsed);
  } catch (err) {
    console.error('[fetchAllDietStats] Error:', err);
    return [];
  }
}

/**
 * Fetch diet events created after `since` timestamp. Used for delta updates.
 */
export async function fetchDietStatsSince(since: string): Promise<DietStatDay[]> {
  const user = await requireUser();

  try {
    const events = await prisma.event.findMany({
      where: {
        userId: user.id,
        trackedType: 'DIET',
        rawJson: { not: Prisma.DbNull },
        createdAt: { gt: new Date(since) },
      },
      select: {
        rawJson: true,
        occurredAt: true,
        content: true,
        createdAt: true,
      },
      orderBy: { occurredAt: 'desc' },
    });

    const parsed = events.map(e => parseEvent(e)).filter(Boolean) as DietStatDay[];
    return aggregateByDate(parsed);
  } catch (err) {
    console.error('[fetchDietStatsSince] Error:', err);
    return [];
  }
}

function aggregateByDate(days: DietStatDay[]): DietStatDay[] {
  const map = new Map<string, DietStatDay>();
  for (const d of days) {
    const existing = map.get(d.date);
    if (existing) {
      existing.calories += d.calories;
      existing.protein += d.protein;
      existing.carbs += d.carbs;
      existing.fat += d.fat;
      if (d.fiber != null) existing.fiber = (existing.fiber ?? 0) + d.fiber;
      existing.mealCount += d.mealCount;
      // keep the latest fetchedAt
      if (d.fetchedAt > existing.fetchedAt) existing.fetchedAt = d.fetchedAt;
    } else {
      map.set(d.date, { ...d });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function parseEvent(event: {
  rawJson: unknown;
  occurredAt: Date | null;
  content: string;
  createdAt: Date;
}): DietStatDay | null {
  const json = event.rawJson as Record<string, unknown> | null;
  if (!json) return null;

  const summary = json.summary as Record<string, unknown> | undefined;
  const meals = json.meals as unknown[] | undefined;
  const totalMacros = summary?.totalMacros as Record<string, number> | undefined;

  if (!totalMacros || !totalMacros.calories) return null;

  const date = event.occurredAt
    ? new Date(event.occurredAt).toISOString().split('T')[0]
    : 'unknown';

  return {
    date,
    calories: Math.round(totalMacros.calories || 0),
    protein: Math.round(totalMacros.protein || 0),
    carbs: Math.round(totalMacros.carbs || 0),
    fat: Math.round(totalMacros.fat || 0),
    fiber: summary?.totalFiber != null ? Math.round(summary.totalFiber as number) : undefined,
    mealCount: Array.isArray(meals) ? meals.length : (summary?.totalMeals as number) || 0,
    notes: event.content || undefined,
    fetchedAt: event.createdAt.toISOString(),
  };
}
