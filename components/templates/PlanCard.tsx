'use client';

import { ChevronRight, Trash2 } from 'lucide-react';
import type { WorkoutPlan, SplitType } from '@/lib/sessions/types';

interface PlanCardProps {
  plan: WorkoutPlan;
  onClick?: () => void;
  onDelete?: () => void;
}

const splitLabels: Record<SplitType, string> = {
  ppl: 'PPL',
  upper_lower: 'Upper/Lower',
  full_body: 'Full Body',
  bro_split: 'Bro Split',
  push_pull: 'Push/Pull',
  custom: 'Custom',
};

export function PlanCard({ plan, onClick, onDelete }: PlanCardProps) {
  const trainingDays = plan.days.filter((d) => !d.isRestDay).length;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

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
          <span>{trainingDays} days</span>
          <span className="text-[var(--color-line)]">|</span>
          <span>{splitLabels[plan.preferences.splitType] || plan.preferences.splitType}</span>
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
