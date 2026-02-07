'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useMealPlansStore } from '@/store/meal-plans.store';
import { useHydrated } from '@/hooks/useHydrated';
import { MealPlanCard } from '@/components/meal-plans';
import { BackButton } from '@/components/ui/BackButton';

export default function MealPlansPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const plansMap = useMealPlansStore((s) => s.mealPlans);
  const planIds = useMealPlansStore((s) => s.mealPlanIds);
  const plans = useMemo(
    () => planIds.map((id) => plansMap[id]).filter(Boolean),
    [planIds, plansMap]
  );
  const deletePlan = useMealPlansStore((s) => s.deleteMealPlan);

  const handleDelete = (id: string) => {
    if (confirm('Delete this meal plan?')) {
      deletePlan(id);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <span className="text-sm font-medium text-[var(--color-text)]">Meal Plans</span>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        <span className="text-sm font-medium text-[var(--color-text)]">Meal Plans</span>
        <button
          onClick={() => router.push('/meal-plans/new')}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--color-lime)] border border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/10"
        >
          <Plus className="w-3 h-3" />
          New Plan
        </button>
      </header>

      {/* Plans list */}
      <main className="flex-1">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4">
            <p className="text-sm text-[var(--color-muted)]">No meal plans</p>
            <p className="text-xs text-[var(--color-muted)]/60 mt-1">
              Create one to get started
            </p>
            <button
              onClick={() => router.push('/meal-plans/new')}
              className="mt-4 flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-lime)] border border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/10"
            >
              <Plus className="w-3.5 h-3.5" />
              New Plan
            </button>
          </div>
        ) : (
          <div>
            {plans.map((plan) => (
              <MealPlanCard
                key={plan.id}
                plan={plan}
                onClick={() => router.push(`/meal-plans/${plan.id}`)}
                onDelete={() => handleDelete(plan.id)}
              />
            ))}
          </div>
        )}
      </main>

      <BackButton />
    </div>
  );
}
