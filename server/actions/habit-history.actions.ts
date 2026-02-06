"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import type { HabitLog } from "@/lib/sessions/types";

export interface HabitHistoryDay {
  date: string;
  habitLog: HabitLog;
}

/**
 * Get habit history for a date range
 */
export async function getHabitHistory(
  startDate: string,
  endDate: string
): Promise<HabitHistoryDay[]> {
  const user = await requireUser();

  const results = await prisma.$queryRaw<Array<{
    occurredAt: Date;
    rawJson: HabitLog;
  }>>`
    SELECT
      e."occurredAt",
      e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'HABIT'
      AND e."rawJson" IS NOT NULL
      AND e."occurredAt" >= ${new Date(startDate)}::timestamp
      AND e."occurredAt" <= ${new Date(endDate)}::timestamp
    ORDER BY e."occurredAt" DESC
  `;

  return results.map((r) => ({
    date: r.occurredAt.toISOString().split('T')[0],
    habitLog: r.rawJson,
  }));
}

/**
 * Get the most recent N days of habit data
 */
export async function getRecentHabitDays(
  limit: number = 90
): Promise<HabitHistoryDay[]> {
  const user = await requireUser();

  const results = await prisma.$queryRaw<Array<{
    occurredAt: Date;
    rawJson: HabitLog;
  }>>`
    SELECT
      e."occurredAt",
      e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'HABIT'
      AND e."rawJson" IS NOT NULL
    ORDER BY e."occurredAt" DESC
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    date: r.occurredAt.toISOString().split('T')[0],
    habitLog: r.rawJson,
  }));
}
