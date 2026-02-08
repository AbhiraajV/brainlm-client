'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { WorkoutPreferences, MuscleGroup } from '@/lib/sessions/types';

interface PreferencesSummaryProps {
  preferences: WorkoutPreferences;
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function asArray<T>(v: T | T[]): T[] { return Array.isArray(v) ? v : [v]; }

export function PreferencesSummary({ preferences }: PreferencesSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const goalText = asArray(preferences.trainingGoal).map(formatLabel).join(', ');
  const summary = `${goalText} · ${preferences.daysPerWeek} days · ${preferences.sessionDuration}min`;

  return (
    <div className="border-b border-[var(--color-line)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[var(--color-surface)]/50"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]" />
        )}
        <span className="text-xs text-[var(--color-muted)]">{summary}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {asArray(preferences.trainingGoal).map((g) => (
            <Tag key={`goal-${g}`} label={formatLabel(g)} />
          ))}
          <Tag label={formatLabel(preferences.experienceLevel)} />
          {asArray(preferences.equipmentAccess).map((e) => (
            <Tag key={`equip-${e}`} label={formatLabel(e)} />
          ))}
          <Tag label={`${preferences.daysPerWeek} days/wk`} />
          <Tag label={`${preferences.sessionDuration}min`} />
          <Tag label={formatLabel(preferences.splitType)} />
          {preferences.cardioLevel !== 'none' && (
            <Tag label={`Cardio: ${formatLabel(preferences.cardioLevel)}`} />
          )}
          {preferences.focusAreas.map((mg) => (
            <Tag key={`focus-${mg}`} label={`+ ${formatLabel(mg)}`} variant="lime" />
          ))}
          {preferences.deprioritizeAreas.map((mg) => (
            <Tag key={`depri-${mg}`} label={`- ${formatLabel(mg)}`} variant="muted" />
          ))}
          {preferences.injuries && <Tag label={preferences.injuries} variant="muted" />}
        </div>
      )}
    </div>
  );
}

function Tag({ label, variant }: { label: string; variant?: 'lime' | 'muted' }) {
  const colorClass =
    variant === 'lime'
      ? 'text-[var(--color-lime)] border-[var(--color-lime)]/30'
      : variant === 'muted'
      ? 'text-[var(--color-muted)]/70 border-[var(--color-line)]'
      : 'text-[var(--color-muted)] border-[var(--color-line)]';

  return (
    <span className={`text-[10px] px-1.5 py-0.5 border ${colorClass}`}>
      {label}
    </span>
  );
}
