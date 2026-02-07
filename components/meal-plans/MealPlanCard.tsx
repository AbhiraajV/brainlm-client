'use client';

import { ChevronRight, Trash2 } from 'lucide-react';
import type { MealPlan, DietGoal } from '@/lib/sessions/types';

interface MealPlanCardProps {
  plan: MealPlan;
  onClick?: () => void;
  onDelete?: () => void;
}

const goalLabels: Record<DietGoal, string> = {
  weight_loss: 'Cutting',
  muscle_gain: 'Bulking',
  maintenance: 'Maintenance',
  body_recomp: 'Recomp',
  performance: 'Performance',
  health: 'Health',
};

export function MealPlanCard({ plan, onClick, onDelete }: MealPlanCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const goalLabel = goalLabels[plan.preferences.dietGoal] || plan.preferences.dietGoal;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-line)] hover:bg-[var(--color-surface)]/50 cursor-pointer group"
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-[var(--color-text)] block truncate">
          {plan.name}
        </span>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted)]">
          <span>{goalLabel}</span>
          <span className="text-[var(--color-line)]">|</span>
          <span>{plan.targetCalories} cal</span>
          <span className="text-[var(--color-line)]">|</span>
          <span>{plan.targets.protein}g P</span>
          {plan.meals.length > 0 && (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span>{plan.meals.length} meals</span>
            </>
          )}
          {plan.usageCount > 0 && (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span>{plan.usageCount}x</span>
            </>
          )}
        </div>
      </div>

      {onDelete && (
        <button
          onClick={handleDelete}
          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-coral)] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      <ChevronRight className="w-4 h-4 text-[var(--color-muted)]/50" />
    </div>
  );
}
