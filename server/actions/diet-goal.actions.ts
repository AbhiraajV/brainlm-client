'use server';

import { requireUser } from '@/server/auth';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/prisma/client';

export interface DietGoalContext {
  baseline: string | null;
  parsedStats: {
    weight?: number;
    weightUnit?: 'kg' | 'lbs';
    height?: number;
    heightUnit?: 'cm' | 'ft';
    age?: number;
    gender?: string;
  };
  trainingDaysPerWeek: number | null;
  avgCalories: number | null;
  avgProtein: number | null;
}

/**
 * Fetch pre-fill data for the diet goal questionnaire.
 * Pure DB queries + regex parsing — no LLM calls.
 */
export async function getDietGoalContext(): Promise<DietGoalContext> {
  const user = await requireUser();

  // 1. Get user baseline
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { baseline: true },
  });

  const baseline = dbUser?.baseline ?? null;

  // 2. Parse stats from baseline with regex
  const parsedStats: DietGoalContext['parsedStats'] = {};

  if (baseline) {
    // Weight patterns: "80kg", "80 kg", "180 lbs", "weight: 80kg"
    const weightMatch = baseline.match(/(?:weight[:\s]*)?(\d{2,3})\s*(kg|lbs|lb|pounds)/i);
    if (weightMatch) {
      parsedStats.weight = parseFloat(weightMatch[1]);
      parsedStats.weightUnit = weightMatch[2].toLowerCase().startsWith('lb') ? 'lbs' : 'kg';
    }

    // Height patterns: "180cm", "180 cm", "5'11", "5 ft 11", "height: 180cm"
    const heightCmMatch = baseline.match(/(?:height[:\s]*)?(\d{2,3})\s*cm/i);
    const heightFtMatch = baseline.match(/(\d)'?\s*(\d{1,2})/);
    if (heightCmMatch) {
      parsedStats.height = parseFloat(heightCmMatch[1]);
      parsedStats.heightUnit = 'cm';
    } else if (heightFtMatch) {
      // Convert ft'in to total feet (decimal) for display, store as ft
      const feet = parseInt(heightFtMatch[1]);
      const inches = parseInt(heightFtMatch[2]);
      parsedStats.height = Math.round((feet * 30.48 + inches * 2.54));
      parsedStats.heightUnit = 'cm';
    }

    // Age patterns: "25 years old", "age: 25", "25M", "25F", "25yo"
    const ageMatch = baseline.match(/(?:age[:\s]*)?(\d{2})\s*(?:years?\s*old|yo|[MF]\b)/i);
    if (ageMatch) {
      parsedStats.age = parseInt(ageMatch[1]);
    }

    // Gender patterns: "male", "female", "25M", "25F"
    const genderMatch = baseline.match(/\b(male|female|man|woman)\b/i) ||
                         baseline.match(/\d{2}\s*([MF])\b/);
    if (genderMatch) {
      const g = genderMatch[1].toLowerCase();
      if (g === 'f' || g === 'female' || g === 'woman') {
        parsedStats.gender = 'female';
      } else {
        parsedStats.gender = 'male';
      }
    }
  }

  // 3. Count gym events in last 14 days to estimate training frequency
  let trainingDaysPerWeek: number | null = null;
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const gymEventCount = await prisma.event.count({
      where: {
        userId: user.id,
        trackedType: 'GYM',
        occurredAt: { gte: twoWeeksAgo },
      },
    });

    if (gymEventCount > 0) {
      trainingDaysPerWeek = Math.round(gymEventCount / 2); // 14 days → per week
    }
  } catch {
    // trackedType column may not exist yet if migration hasn't run
  }

  // 4. Average recent diet event macros
  let avgCalories: number | null = null;
  let avgProtein: number | null = null;
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const dietEvents = await prisma.event.findMany({
      where: {
        userId: user.id,
        trackedType: 'DIET',
        occurredAt: { gte: oneWeekAgo },
        rawJson: { not: Prisma.DbNull },
      },
      select: { rawJson: true },
      take: 7,
      orderBy: { occurredAt: 'desc' },
    });

    if (dietEvents.length > 0) {
      let totalCal = 0;
      let totalProtein = 0;
      let count = 0;

      for (const event of dietEvents) {
        const json = event.rawJson as Record<string, unknown> | null;
        if (json?.summary && typeof json.summary === 'object') {
          const summary = json.summary as Record<string, unknown>;
          if (summary.totalMacros && typeof summary.totalMacros === 'object') {
            const macros = summary.totalMacros as Record<string, number>;
            if (macros.calories > 0) {
              totalCal += macros.calories;
              totalProtein += macros.protein || 0;
              count++;
            }
          }
        }
      }

      if (count > 0) {
        avgCalories = Math.round(totalCal / count);
        avgProtein = Math.round(totalProtein / count);
      }
    }
  } catch {
    // rawJson/trackedType columns may not exist yet
  }

  return {
    baseline,
    parsedStats,
    trainingDaysPerWeek,
    avgCalories,
    avgProtein,
  };
}
