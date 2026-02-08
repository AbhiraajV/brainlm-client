'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import type { ExerciseLibraryEntry, ExerciseSessionSnapshot, ExerciseInsight } from '@/lib/sessions/types';
import { formatSetsCompact } from '@/lib/gym/exercise-library-utils';

interface ExerciseDetailRowProps {
  exercise: ExerciseLibraryEntry;
}

const INITIAL_SESSIONS = 5;

const insightColors: Record<ExerciseInsight['severity'], string> = {
  positive: 'bg-[var(--color-lime)]/15 text-[var(--color-lime)]',
  neutral: 'bg-[var(--color-line)] text-[var(--color-muted)]',
  warning: 'bg-[var(--color-coral)]/15 text-[var(--color-coral)]',
};

function isPRSession(session: ExerciseSessionSnapshot, exercise: ExerciseLibraryEntry): string[] {
  const badges: string[] = [];
  if (session.date === exercise.prWeightDate) badges.push('Weight PR');
  if (session.date === exercise.prE1RMDate) badges.push('E1RM PR');
  if (session.date === exercise.prVolumeDate) badges.push('Volume PR');
  return badges;
}

function formatSessionDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function PlanSourcesSection({ exercise }: { exercise: ExerciseLibraryEntry }) {
  if (!exercise.planSources || exercise.planSources.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-[10px] text-[var(--color-muted)]/70 uppercase tracking-wide mb-1">Plan targets</p>
      <div className="space-y-1">
        {exercise.planSources.map((src, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="text-[var(--color-muted)] w-24 shrink-0 truncate">{src.dayLabel}</span>
            <span className="text-[var(--color-text)]">
              {src.targetSets}×{src.targetReps}
              {src.targetWeight ? ` @ ${src.targetWeight}` : ''}
            </span>
            <span className="text-[var(--color-muted)]/50 text-[10px] truncate">{src.planName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanOnlyDetail({ exercise }: { exercise: ExerciseLibraryEntry }) {
  return (
    <div className="px-4 pb-3 border-b border-[var(--color-line)] bg-[var(--color-surface)]/30">
      <p className="text-[11px] text-[var(--color-muted)] mb-2">Not performed yet</p>
      <PlanSourcesSection exercise={exercise} />
    </div>
  );
}

export function ExerciseDetailRow({ exercise }: ExerciseDetailRowProps) {
  const [showAll, setShowAll] = useState(false);

  if (exercise.isPlanOnly) {
    return <PlanOnlyDetail exercise={exercise} />;
  }

  const sessions = showAll
    ? exercise.sessions
    : exercise.sessions.slice(0, INITIAL_SESSIONS);
  const hasMore = exercise.sessions.length > INITIAL_SESSIONS;

  return (
    <div className="px-4 pb-3 border-b border-[var(--color-line)] bg-[var(--color-surface)]/30">
      {/* Insights */}
      {exercise.insights.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {exercise.insights.map((insight, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 text-[10px] rounded-full ${insightColors[insight.severity]}`}
            >
              {insight.message}
            </span>
          ))}
        </div>
      )}

      {/* Session history */}
      <div className="space-y-2">
        {sessions.map((session) => {
          const prBadges = isPRSession(session, exercise);
          return (
            <div key={session.eventId} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--color-muted)] w-16 shrink-0">
                  {formatSessionDate(session.date)}
                </span>
                {session.workoutName && (
                  <span className="text-[11px] text-[var(--color-text)]/60 truncate">
                    {session.workoutName}
                  </span>
                )}
                {prBadges.length > 0 && (
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <Trophy className="w-3 h-3 text-[var(--color-lime)]" />
                    <span className="text-[10px] text-[var(--color-lime)]">
                      {prBadges.join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pl-16">
                <span className="text-[11px] text-[var(--color-text)]">
                  {formatSetsCompact(session)}
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  e1rm ~{Math.round(session.topE1RM)}
                </span>
              </div>
              {session.exerciseNotes && (
                <p className="text-[10px] text-[var(--color-muted)]/70 pl-16 italic">
                  {session.exerciseNotes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Show all toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[11px] text-[var(--color-lime)] hover:underline"
        >
          {showAll
            ? 'Show less'
            : `Show all ${exercise.sessions.length} sessions`}
        </button>
      )}

      {/* Plan targets (for exercises that exist in both history and plans) */}
      <PlanSourcesSection exercise={exercise} />
    </div>
  );
}
