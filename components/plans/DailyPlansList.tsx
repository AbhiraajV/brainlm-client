'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DailyPlanCard, type DailyPlanData } from './DailyPlanCard';
import { useUiStore } from '@/store/ui.store';

interface DailyPlansListProps {
  initialPlans: DailyPlanData[];
  hasMore: boolean;
  initialCursor?: string;
}

export function DailyPlansList({
  initialPlans,
  hasMore: initialHasMore,
  initialCursor,
}: DailyPlansListProps) {
  const [plans] = useState(initialPlans);
  const { openFullscreenReader } = useUiStore();

  const handleReadMore = (plan: DailyPlanData) => {
    openFullscreenReader('plan', {
      id: plan.id,
      content: plan.renderedMarkdown,
      planTitle: `Plan for ${new Date(plan.targetDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}`,
      targetDate: plan.targetDate,
    });
  };

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <div className="
          w-16 h-16 mb-4
          rounded-full
          bg-[var(--color-bg)]
          flex items-center justify-center
        ">
          <CalendarDays className="w-8 h-8 text-[var(--color-muted)]" />
        </div>
        <h3 className="font-serif font-semibold text-lg text-[var(--color-text)] mb-2">
          No plans yet
        </h3>
        <p className="text-sm text-[var(--color-muted)] text-center max-w-xs">
          Daily plans are generated from your reviews. Keep logging your thoughts and we'll create personalized plans for you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <DailyPlanCard
          key={plan.id}
          plan={plan}
          onReadMore={() => handleReadMore(plan)}
        />
      ))}
    </div>
  );
}
