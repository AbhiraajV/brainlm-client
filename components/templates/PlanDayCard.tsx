'use client';

import { Moon, Activity, ChevronRight } from 'lucide-react';
import type { PlanDay, MuscleGroup } from '@/lib/sessions/types';

interface PlanDayCardProps {
  day: PlanDay;
  onClick?: () => void;
}

const muscleGroupColors: Record<MuscleGroup, string> = {
  chest: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  back: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  shoulders: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  biceps: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  triceps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  forearms: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  quadriceps: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  hamstrings: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  glutes: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  calves: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  abs: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  obliques: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  lower_back: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  traps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  lats: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  full_body: 'bg-[var(--color-line)] text-[var(--color-muted)]',
};

function formatMuscleGroup(mg: MuscleGroup): string {
  return mg.replace(/_/g, ' ');
}

export function PlanDayCard({ day, onClick }: PlanDayCardProps) {
  if (day.isRestDay) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-line)] opacity-60">
        <Moon className="w-4 h-4 text-[var(--color-muted)]" />
        <div className="flex-1">
          <span className="text-sm text-[var(--color-muted)]">{day.dayLabel}</span>
          <span className="text-sm text-[var(--color-muted)] ml-2">{day.name}</span>
          {day.description && (
            <p className="text-[11px] text-[var(--color-muted)]/60 mt-0.5">{day.description}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-line)] hover:bg-[var(--color-surface)]/50 cursor-pointer group"
    >
      {day.isCardioDay ? (
        <Activity className="w-4 h-4 text-[var(--color-mint)]" />
      ) : (
        <div className="w-4 h-4 flex items-center justify-center text-[11px] font-medium text-[var(--color-muted)]">
          {day.dayNumber}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text)] truncate">{day.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {day.targetMuscles.slice(0, 4).map((mg) => (
            <span
              key={mg}
              className={`text-[10px] px-1.5 py-0.5 ${muscleGroupColors[mg]}`}
            >
              {formatMuscleGroup(mg)}
            </span>
          ))}
          {day.targetMuscles.length > 4 && (
            <span className="text-[10px] text-[var(--color-muted)]">+{day.targetMuscles.length - 4}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-muted)]">
          {day.estimatedDuration > 0 && <span>~{day.estimatedDuration}min</span>}
          {day.exercises.length > 0 ? (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span>{day.exercises.length} exercises</span>
            </>
          ) : (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span className="text-[var(--color-lime)]/70">Tap to add exercises</span>
            </>
          )}
          {day.cardioNotes && (
            <>
              <span className="text-[var(--color-line)]">|</span>
              <span>{day.cardioNotes}</span>
            </>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-[var(--color-muted)]/50" />
    </div>
  );
}
