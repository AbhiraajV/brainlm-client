'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, Play } from 'lucide-react';
import { useMealPlansStore, useMealPlan } from '@/store/meal-plans.store';
import { useTrackerStore } from '@/store/tracker.store';
import { useHydrated } from '@/hooks/useHydrated';
import { MealPlanMealList } from '@/components/meal-plans';
import { BackButton } from '@/components/ui/BackButton';
import { createEmptyDietLog } from '@/lib/diet/macros';
import type { DietGoal } from '@/lib/sessions/types';

const goalLabels: Record<DietGoal, string> = {
  weight_loss: 'Cutting',
  muscle_gain: 'Bulking',
  maintenance: 'Maintenance',
  body_recomp: 'Recomp',
  performance: 'Performance',
  health: 'Health',
};

export default function MealPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const router = useRouter();

  const plan = useMealPlan(id);
  const updateMealPlan = useMealPlansStore((s) => s.updateMealPlan);
  const incrementMealPlanUsage = useMealPlansStore((s) => s.incrementMealPlanUsage);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const handleSaveName = () => {
    if (editedName.trim() && plan) {
      updateMealPlan(id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleUsePlan = () => {
    if (!plan) return;

    const store = useTrackerStore.getState();
    store.initTracker('diet');
    const dietLog = createEmptyDietLog(plan.targets);
    store.setDietLog(dietLog);

    incrementMealPlanUsage(plan.id);
    router.push('/diet');
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Meal Plan</div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Meal Plan</div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-sm text-[var(--color-text)]">Plan not found</p>
          <button
            onClick={() => router.push('/meal-plans')}
            className="mt-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Back to plans
          </button>
        </main>
        <BackButton />
      </div>
    );
  }

  const goalLabel = goalLabels[plan.preferences.dietGoal] || plan.preferences.dietGoal;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        {isEditingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm font-medium bg-transparent border-b border-[var(--color-lime)] focus:outline-none"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <button onClick={handleSaveName} className="p-1 text-[var(--color-lime)]">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditedName(plan.name); setIsEditingName(true); }}
            className="flex items-center gap-1.5 group"
          >
            <span className="text-sm font-medium text-[var(--color-text)]">
              {plan.name}
            </span>
            <Pencil className="w-3 h-3 text-[var(--color-muted)] opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </header>

      <main className="flex-1">
        {/* Info bar */}
        <div className="px-4 py-2 border-b border-[var(--color-line)] flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
          <span>{goalLabel}</span>
          <span className="text-[var(--color-line)]">|</span>
          <span>{plan.targetCalories} cal</span>
          <span className="text-[var(--color-line)]">|</span>
          <span>{plan.meals.length} meals</span>
          {plan.usageCount > 0 && (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span>{plan.usageCount}x used</span>
            </>
          )}
        </div>

        {/* Description */}
        {plan.description && (
          <div className="px-4 py-2 text-xs text-[var(--color-muted)] border-b border-[var(--color-line)]">
            {plan.description}
          </div>
        )}

        {/* Daily targets */}
        <div className="px-4 py-3 border-b border-[var(--color-line)]">
          <h3 className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-2">Daily Targets</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-lg font-medium text-[var(--color-text)]">{plan.targets.calories}</div>
              <div className="text-[10px] text-[var(--color-muted)]">Calories</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-[var(--color-coral)]">{plan.targets.protein}g</div>
              <div className="text-[10px] text-[var(--color-muted)]">Protein</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-[var(--color-mint)]">{plan.targets.carbs}g</div>
              <div className="text-[10px] text-[var(--color-muted)]">Carbs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-[var(--color-lime)]">{plan.targets.fat}g</div>
              <div className="text-[10px] text-[var(--color-muted)]">Fat</div>
            </div>
          </div>
          {plan.tdee && (
            <div className="mt-2 text-[10px] text-[var(--color-muted)] text-center">
              TDEE: {plan.tdee} cal
              {plan.proteinPerKg && ` · ${plan.proteinPerKg}g/kg protein`}
            </div>
          )}
        </div>

        {/* Rationale */}
        {plan.rationale && (
          <div className="px-4 py-3 border-b border-[var(--color-line)]">
            <h3 className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1.5">Rationale</h3>
            <p className="text-xs text-[var(--color-text)] leading-relaxed whitespace-pre-line">
              {plan.rationale}
            </p>
          </div>
        )}

        {/* Meals */}
        <div className="py-1">
          <MealPlanMealList meals={plan.meals} />
        </div>

        {/* Spacer for fixed button */}
        <div className="h-24" />
      </main>

      {/* Use This Plan button */}
      {plan.meals.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent pt-6">
          <button
            onClick={handleUsePlan}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 px-4 bg-[var(--color-lime)] text-[var(--color-bg)] font-medium text-sm hover:bg-[var(--color-lime)]/90 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Use This Plan
          </button>
        </div>
      )}

      <BackButton />
    </div>
  );
}
