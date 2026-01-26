'use client';

import { useState } from 'react';
import { Dumbbell, ChevronDown, ChevronRight, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import type { SuggestedWorkout as SuggestedWorkoutType } from '@/lib/sessions/types';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface Props {
  suggestedWorkout?: SuggestedWorkoutType;
  onGenerate?: () => void;
  isGenerating?: boolean;
}

export function SuggestedWorkout({ suggestedWorkout, onGenerate, isGenerating }: Props) {
  const [isExpanded, setIsExpanded] = useState(!!suggestedWorkout);
  const [isReasonExpanded, setIsReasonExpanded] = useState(false);

  // Show generate button if no workout and onGenerate is provided
  if (!suggestedWorkout && onGenerate) {
    return (
      <div className="-mx-5 sm:-mx-7 px-5 sm:px-7 py-3 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing your history...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Workout Plan
            </>
          )}
        </button>
      </div>
    );
  }

  if (!suggestedWorkout) {
    return null;
  }

  return (
    <div className="-mx-5 sm:-mx-7 px-5 sm:px-7 py-3 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text)]">
            Suggested Workout
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            ({suggestedWorkout.exercises.length} exercises)
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)]" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3">
          {/* Exercise Table */}
          <div className="overflow-x-auto mb-3">
            <table className="text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th className="text-left py-2 pr-6 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide whitespace-nowrap">
                    Exercise
                  </th>
                  <th className="text-left py-2 pr-6 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide whitespace-nowrap">
                    Sets
                  </th>
                  <th className="text-left py-2 pr-6 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide whitespace-nowrap">
                    Reps
                  </th>
                  <th className="text-left py-2 pr-6 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide whitespace-nowrap">
                    Weight
                  </th>
                  <th className="text-left py-2 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide whitespace-nowrap">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {suggestedWorkout.exercises.map((exercise, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-6 text-[var(--color-text)] font-medium whitespace-nowrap">
                      {exercise.name}
                    </td>
                    <td className="py-2 pr-6 text-[var(--color-text)] whitespace-nowrap">
                      {exercise.sets}
                    </td>
                    <td className="py-2 pr-6 text-[var(--color-text)] whitespace-nowrap">
                      {exercise.reps}
                    </td>
                    <td className="py-2 pr-6 text-[var(--color-text)] whitespace-nowrap">
                      {exercise.weight || '-'}
                    </td>
                    <td className="py-2 text-[var(--color-muted)] text-xs">
                      {exercise.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reason Section */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsReasonExpanded(!isReasonExpanded);
            }}
            className="flex items-center gap-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {isReasonExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Lightbulb className="w-3 h-3" />
            <span>Why this workout?</span>
          </button>

          {isReasonExpanded && (
            <div className="mt-2 p-3 bg-[var(--color-bg)] text-xs text-[var(--color-text)] leading-relaxed">
              <MarkdownRenderer content={suggestedWorkout.reason} />
            </div>
          )}

          {/* Regenerate button */}
          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
