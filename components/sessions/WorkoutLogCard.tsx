'use client';

import { useState } from 'react';
import type { WorkoutLog, ExerciseEntry, WorkoutSet, MuscleGroup } from '@/lib/sessions/types';
import { ChevronDown, ChevronUp, Dumbbell, Trophy, Target, Flame } from 'lucide-react';

interface WorkoutLogCardProps {
  workoutLog: WorkoutLog | undefined;
  isLoading?: boolean;
}

// Muscle group colors
const muscleGroupColors: Record<MuscleGroup, string> = {
  chest: 'bg-red-100 text-red-700',
  back: 'bg-blue-100 text-blue-700',
  shoulders: 'bg-orange-100 text-orange-700',
  biceps: 'bg-purple-100 text-purple-700',
  triceps: 'bg-pink-100 text-pink-700',
  forearms: 'bg-amber-100 text-amber-700',
  quadriceps: 'bg-green-100 text-green-700',
  hamstrings: 'bg-teal-100 text-teal-700',
  glutes: 'bg-rose-100 text-rose-700',
  calves: 'bg-lime-100 text-lime-700',
  abs: 'bg-cyan-100 text-cyan-700',
  obliques: 'bg-sky-100 text-sky-700',
  lower_back: 'bg-indigo-100 text-indigo-700',
  traps: 'bg-violet-100 text-violet-700',
  lats: 'bg-blue-100 text-blue-700',
  full_body: 'bg-gray-100 text-gray-700',
};

// Format muscle group for display
function formatMuscleGroup(mg: MuscleGroup): string {
  return mg.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Set chip component
function SetChip({ set }: { set: WorkoutSet }) {
  const isSpecial = set.setType !== 'working';
  const bgClass = isSpecial ? 'bg-[var(--color-accent-light)]' : 'bg-[var(--color-surface)]';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${bgClass} border border-[var(--color-line)]`}>
      <span className="font-medium">{set.actualReps}</span>
      <span className="text-[var(--color-muted)]">x</span>
      <span className="font-medium">
        {set.weight === 0 ? 'BW' : `${set.weight}${set.weightUnit}`}
      </span>
      {isSpecial && (
        <span className="text-[var(--color-accent)] text-[10px] ml-0.5">
          {set.setType.replace(/_/g, ' ')}
        </span>
      )}
    </span>
  );
}

// Exercise section component
function ExerciseSection({ exercise, isExpanded, onToggle }: {
  exercise: ExerciseEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const totalReps = exercise.sets.reduce((sum, s) => sum + s.actualReps, 0);
  const totalVolume = exercise.sets.reduce((sum, s) => sum + (s.weight * s.actualReps), 0);
  const unit = exercise.sets[0]?.weightUnit || 'kg';

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0">
      {/* Exercise header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-[var(--color-surface)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text)]">{exercise.exerciseName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${muscleGroupColors[exercise.muscleGroup]}`}>
            {formatMuscleGroup(exercise.muscleGroup)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-muted)]">
            {exercise.sets.length} sets | {totalReps} reps
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
          )}
        </div>
      </button>

      {/* Expanded sets view */}
      {isExpanded && (
        <div className="pb-3 px-1">
          <div className="flex flex-wrap gap-1.5">
            {exercise.sets.map((set, idx) => (
              <SetChip key={idx} set={set} />
            ))}
          </div>
          {totalVolume > 0 && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Volume: {totalVolume.toLocaleString()}{unit}
            </p>
          )}
        </div>
      )}

      {/* Collapsed inline sets */}
      {!isExpanded && (
        <div className="pb-2 px-1">
          <div className="flex flex-wrap gap-1">
            {exercise.sets.slice(0, 4).map((set, idx) => (
              <SetChip key={idx} set={set} />
            ))}
            {exercise.sets.length > 4 && (
              <span className="text-xs text-[var(--color-muted)] px-1">
                +{exercise.sets.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Summary bar component
function WorkoutSummaryBar({ summary, preferredUnit }: {
  summary: WorkoutLog['summary'];
  preferredUnit: WorkoutLog['preferredUnit'];
}) {
  return (
    <div className="flex items-center gap-4 text-xs text-[var(--color-muted)] py-2">
      <span className="flex items-center gap-1">
        <Dumbbell className="w-3.5 h-3.5" />
        {summary.totalExercises} exercises
      </span>
      <span className="flex items-center gap-1">
        <Target className="w-3.5 h-3.5" />
        {summary.totalSets} sets
      </span>
      <span className="flex items-center gap-1">
        <Flame className="w-3.5 h-3.5" />
        {summary.totalVolume.toLocaleString()}{preferredUnit}
      </span>
      {summary.prCount > 0 && (
        <span className="flex items-center gap-1 text-amber-600">
          <Trophy className="w-3.5 h-3.5" />
          {summary.prCount} PR{summary.prCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

/**
 * WorkoutLogCard - Displays structured workout data with collapsible exercises
 */
export function WorkoutLogCard({ workoutLog, isLoading }: WorkoutLogCardProps) {
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());

  const toggleExercise = (id: string) => {
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Determine if we have valid data to show
  const hasData = workoutLog && workoutLog.exercises.length > 0;
  const isEmpty = !workoutLog || workoutLog.exercises.length === 0;

  return (
    <div className="-mx-5 sm:-mx-7 px-5 sm:px-7 py-4 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-[var(--color-muted)]/20 rounded w-1/3" />
          <div className="h-24 bg-[var(--color-muted)]/20 rounded" />
          <div className="h-4 bg-[var(--color-muted)]/20 rounded w-2/3" />
        </div>
      ) : isEmpty ? (
        /* Empty state */
        <div>
          <div className="flex items-center gap-4 text-xs text-[var(--color-muted)] py-2">
            <span className="flex items-center gap-1">
              <Dumbbell className="w-3.5 h-3.5" />
              0 exercises
            </span>
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              0 sets
            </span>
            <span className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              0kg volume
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] text-center py-4 border-t border-[var(--color-line)] mt-2">
            No exercises logged yet. Start logging your workout below.
          </p>
        </div>
      ) : hasData && workoutLog && (
        <div>
          {/* Muscle group badges */}
          {workoutLog.muscleGroups.length > 0 && (
            <div className="flex gap-1 mb-2">
              {workoutLog.muscleGroups.slice(0, 3).map(mg => (
                <span key={mg} className={`text-[10px] px-1.5 py-0.5 rounded ${muscleGroupColors[mg]}`}>
                  {formatMuscleGroup(mg)}
                </span>
              ))}
            </div>
          )}

          {/* Summary bar */}
          <WorkoutSummaryBar summary={workoutLog.summary} preferredUnit={workoutLog.preferredUnit} />

          {/* Exercises */}
          <div className="mt-2">
            {workoutLog.exercises.map(exercise => (
              <ExerciseSection
                key={exercise.id}
                exercise={exercise}
                isExpanded={expandedExercises.has(exercise.id)}
                onToggle={() => toggleExercise(exercise.id)}
              />
            ))}
          </div>

          {/* Notes */}
          {workoutLog.notes && (
            <p className="text-xs text-[var(--color-muted)] mt-3 italic">
              {workoutLog.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
