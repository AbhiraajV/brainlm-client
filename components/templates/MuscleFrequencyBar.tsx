'use client';

import type { MuscleGroup } from '@/lib/sessions/types';

interface MuscleFrequencyBarProps {
  frequency: Record<string, number>;
}

const muscleBarColors: Record<MuscleGroup, string> = {
  chest: 'bg-[var(--color-coral)]',
  back: 'bg-[var(--color-mint)]',
  shoulders: 'bg-[var(--color-coral)]',
  biceps: 'bg-[var(--color-lime)]',
  triceps: 'bg-[var(--color-coral)]',
  forearms: 'bg-[var(--color-lime)]',
  quadriceps: 'bg-[var(--color-mint)]',
  hamstrings: 'bg-[var(--color-mint)]',
  glutes: 'bg-[var(--color-coral)]',
  calves: 'bg-[var(--color-lime)]',
  abs: 'bg-[var(--color-mint)]',
  obliques: 'bg-[var(--color-mint)]',
  lower_back: 'bg-[var(--color-lime)]',
  traps: 'bg-[var(--color-coral)]',
  lats: 'bg-[var(--color-mint)]',
  full_body: 'bg-[var(--color-muted)]',
};

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

export function MuscleFrequencyBar({ frequency }: MuscleFrequencyBarProps) {
  const entries = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const maxHits = Math.max(...entries.map(([, v]) => v));

  return (
    <div className="px-4 py-3 border-b border-[var(--color-line)]">
      <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-2">
        Muscle Frequency
      </div>
      <div className="space-y-1.5">
        {entries.map(([muscle, hits]) => {
          const pct = maxHits > 0 ? (hits / maxHits) * 100 : 0;
          const colorClass = muscleBarColors[muscle as MuscleGroup] || 'bg-[var(--color-muted)]';

          return (
            <div key={muscle} className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--color-muted)] w-20 truncate">
                {formatLabel(muscle)}
              </span>
              <div className="flex-1 h-2 bg-[var(--color-line)] rounded-sm overflow-hidden">
                <div
                  className={`h-full ${colorClass} rounded-sm transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--color-muted)] w-8 text-right">
                {hits}x
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
