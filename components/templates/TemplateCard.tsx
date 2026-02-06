'use client';

import { ChevronRight, Trash2 } from 'lucide-react';
import type { WorkoutTemplate, MuscleGroup } from '@/lib/sessions/types';

interface TemplateCardProps {
  template: WorkoutTemplate;
  onClick?: () => void;
  onDelete?: () => void;
}

function formatMuscleGroup(mg: MuscleGroup): string {
  return mg.replace(/_/g, ' ');
}

export function TemplateCard({ template, onClick, onDelete }: TemplateCardProps) {
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
          {template.name}
        </span>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted)]">
          <span>{template.exercises.length} exercises</span>
          {template.usageCount > 0 && (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span>{template.usageCount}x</span>
            </>
          )}
          {template.muscleGroups.length > 0 && (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span>{template.muscleGroups.slice(0, 2).map(formatMuscleGroup).join(', ')}</span>
              {template.muscleGroups.length > 2 && (
                <span>+{template.muscleGroups.length - 2}</span>
              )}
            </>
          )}
        </div>
      </div>

      {onDelete && (
        <button
          onClick={handleDelete}
          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-coral)] opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      <ChevronRight className="w-4 h-4 text-[var(--color-muted)]/50" />
    </div>
  );
}
