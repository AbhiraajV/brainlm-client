import { requireUser } from '@/server/auth';
import { prisma } from '@/server/prisma/client';
import { DailyPlansList } from './DailyPlansList';
import { ConfidenceLevel } from '@prisma/client';

interface PlansFeedProps {
  limit?: number;
}

// Type definitions for JSON fields
interface FocusArea {
  area: string;
  reasoning: string;
  patternRef?: string;
  confidence: ConfidenceLevel;
}

interface Session {
  timeSlot: string;
  activity: string;
  reasoning: string;
  optional?: boolean;
}

interface Warning {
  warning: string;
  patternId?: string;
  confidence: ConfidenceLevel;
}

interface CTA {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

export async function PlansFeed({ limit = 20 }: PlansFeedProps) {
  const user = await requireUser();

  const plans = await prisma.dailyPlan.findMany({
    where: { userId: user.id },
    orderBy: { targetDate: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      targetDate: true,
      focusAreas: true,
      sessions: true,
      warnings: true,
      ctas: true,
      renderedMarkdown: true,
      createdAt: true,
    },
  });

  const hasMore = plans.length > limit;
  const displayPlans = hasMore ? plans.slice(0, limit) : plans;
  const nextCursor = hasMore
    ? displayPlans[displayPlans.length - 1]?.id
    : undefined;

  // Transform the data to ensure proper typing for JSON fields
  const typedPlans = displayPlans.map((plan) => ({
    id: plan.id,
    targetDate: plan.targetDate,
    focusAreas: (plan.focusAreas as unknown as FocusArea[]) || [],
    sessions: (plan.sessions as unknown as Session[]) || [],
    warnings: (plan.warnings as unknown as Warning[]) || [],
    ctas: (plan.ctas as unknown as CTA[]) || [],
    renderedMarkdown: plan.renderedMarkdown,
    createdAt: plan.createdAt,
  }));

  return (
    <DailyPlansList
      initialPlans={typedPlans}
      hasMore={hasMore}
      initialCursor={nextCursor}
    />
  );
}
