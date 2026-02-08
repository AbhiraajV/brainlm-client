'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Check, Loader2, ChevronDown, Dumbbell, Clock } from 'lucide-react';
import { useTemplatesStore } from '@/store/templates.store';
import { useExercisesStore } from '@/store/exercises.store';
import { getRecentWorkouts, getExerciseTargetsForDay } from '@/server/actions/gym-history.actions';
import { workoutFromPlanDay } from '@/lib/templates/utils';
import { formatMuscleGroup, getMuscleGroupColor, getBroadGroup } from '@/lib/gym/muscle-groups';
import type { WorkoutLog, WorkoutPlan, PlanDay, MuscleGroup } from '@/lib/sessions/types';
import type { WorkoutSummary } from '@/server/actions/gym-history.actions';

interface WorkoutPickerProps {
  sessionId: string;
  onWorkoutSelected: (log: WorkoutLog) => void;
  onStartEmpty: () => void;
}

/**
 * Predict which plan day the user should train next.
 * Tries exact plan match first, then falls back to muscle group overlap
 * so freeform sessions are also recognized in the rotation.
 */
function predictNextPlanDay(
  plan: WorkoutPlan,
  recentWorkouts: WorkoutSummary[]
): PlanDay | undefined {
  const trainingDays = plan.days
    .filter((d) => !d.isRestDay)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (trainingDays.length === 0) return undefined;
  if (recentWorkouts.length === 0) return trainingDays[0];

  // Strategy 1: Match by templateDayId or templateId+workoutName (exact plan match)
  for (const w of recentWorkouts) {
    let matchedIndex = -1;

    if (w.templateDayId) {
      matchedIndex = trainingDays.findIndex((d) => d.id === w.templateDayId);
    }
    if (matchedIndex === -1 && w.templateId === plan.id && w.workoutName) {
      matchedIndex = trainingDays.findIndex(
        (d) => d.name.toLowerCase() === w.workoutName!.toLowerCase()
      );
    }

    if (matchedIndex !== -1) {
      return trainingDays[(matchedIndex + 1) % trainingDays.length];
    }
  }

  // Strategy 2: Match by muscle group overlap (handles freeform sessions)
  const dayBroadMuscles = trainingDays.map((d) =>
    new Set(d.targetMuscles.map(getBroadGroup))
  );

  for (const w of recentWorkouts) {
    if (w.muscleGroups.length === 0) continue;
    const workoutBroad = new Set(w.muscleGroups.map(getBroadGroup));

    let bestDayIndex = -1;
    let bestOverlap = 0;

    for (let i = 0; i < trainingDays.length; i++) {
      const overlap = [...workoutBroad].filter((mg) => dayBroadMuscles[i].has(mg)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestDayIndex = i;
      }
    }

    if (bestDayIndex !== -1 && bestOverlap > 0) {
      return trainingDays[(bestDayIndex + 1) % trainingDays.length];
    }
  }

  // No match at all — default to first day
  return trainingDays[0];
}

/** Find when a plan day was last done from recent workout history */
function getLastDoneDate(day: PlanDay, planId: string, recentWorkouts: WorkoutSummary[]): string | null {
  const match = recentWorkouts.find((w) => {
    if (w.templateDayId === day.id) return true;
    if (w.templateId === planId && w.workoutName?.toLowerCase() === day.name.toLowerCase()) return true;
    return false;
  });
  if (!match) return null;
  const d = new Date(match.date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Custom dropdown component */
function CustomSelect<T extends string>({
  label,
  value,
  open,
  onToggle,
  onClose,
  children,
  renderSelected,
}: {
  label: string;
  value: T | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  renderSelected: () => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-1 block">
        {label}
      </label>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left text-sm bg-[var(--color-bg)] border border-[var(--color-line)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-lime)] flex items-center justify-between gap-2"
      >
        <div className="flex-1 min-w-0">
          {value ? renderSelected() : (
            <span className="text-[var(--color-muted)]">Select...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--color-muted)] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-line)] rounded shadow-lg max-h-64 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

export function WorkoutPicker({ sessionId, onWorkoutSelected, onStartEmpty }: WorkoutPickerProps) {
  const plans = useTemplatesStore((s) => s.plans);
  const planIds = useTemplatesStore((s) => s.planIds);
  const activePlanId = useTemplatesStore((s) => s.activePlanId);

  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);
  const [fetchedRecent, setFetchedRecent] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(activePlanId);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [dayAutoSelected, setDayAutoSelected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);

  // Fetch recent workouts on mount
  useEffect(() => {
    if (fetchedRecent) return;
    setFetchedRecent(true);
    getRecentWorkouts(undefined, 20)
      .then((data) => { setRecentWorkouts(data); setRecentLoaded(true); })
      .catch(() => { setRecentLoaded(true); });
  }, [fetchedRecent]);

  const selectedPlan = selectedPlanId ? plans[selectedPlanId] : null;

  const trainingDays = useMemo(
    () =>
      selectedPlan?.days
        .filter((d) => !d.isRestDay)
        .sort((a, b) => a.orderIndex - b.orderIndex) ?? [],
    [selectedPlan]
  );

  const predictedDay = useMemo(
    () =>
      selectedPlan && recentWorkouts.length >= 0
        ? predictNextPlanDay(selectedPlan, recentWorkouts)
        : undefined,
    [selectedPlan, recentWorkouts]
  );

  useEffect(() => {
    if (predictedDay && !dayAutoSelected && recentLoaded) {
      setSelectedDayId(predictedDay.id);
      setDayAutoSelected(true);
    }
  }, [predictedDay, dayAutoSelected, recentLoaded]);

  const handlePlanChange = useCallback((newPlanId: string) => {
    setSelectedPlanId(newPlanId);
    setSelectedDayId(null);
    setDayAutoSelected(false);
    setPlanOpen(false);
  }, []);

  const handleDayChange = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
    setDayOpen(false);
  }, []);

  const handleStart = useCallback(async () => {
    if (!selectedPlan || !selectedDayId || isLoading) return;
    const selectedDay = selectedPlan.days.find((d) => d.id === selectedDayId);
    if (!selectedDay) return;

    setIsLoading(true);

    try {
      const registry = useExercisesStore.getState();
      const resolvedDay = {
        ...selectedDay,
        exercises: selectedDay.exercises.map((ex) => {
          const def = registry.resolveExercise(ex.exerciseName, ex.muscleGroup, ex.equipmentType);
          return { ...ex, exerciseRegistryId: def.id };
        }),
      };

      const targets = await getExerciseTargetsForDay(
        resolvedDay.exercises.map((ex) => ({
          name: ex.exerciseName,
          registryId: ex.exerciseRegistryId,
        }))
      );

      const workoutLog = workoutFromPlanDay(selectedPlan, resolvedDay);

      for (const ex of workoutLog.exercises) {
        const target = targets.find(
          (t) => t.exerciseName.toLowerCase() === ex.exerciseName.toLowerCase()
        );
        if (!target) continue;

        if (target.lastSession) {
          ex.computed = {
            ...ex.computed,
            totalVolume: 0,
            totalReps: 0,
            bestE1RM: 0,
            lastSession: {
              date: target.lastSession.date,
              topSet: target.lastSession.sets.reduce(
                (best, s) => (s.weight > best.weight ? s : best),
                target.lastSession.sets[0] || { weight: 0, reps: 0 }
              ),
            },
          };
        }

        if (target.suggestedTargets && ex.targets) {
          ex.targets = {
            ...ex.targets,
            weight: target.suggestedTargets.weight,
            weightUnit: target.suggestedTargets.weightUnit,
            reps: target.suggestedTargets.reps,
            sets: target.suggestedTargets.sets,
            rationale: target.suggestedTargets.rationale,
            confidence: target.suggestedTargets.confidence,
            source: target.suggestedTargets.source as 'history' | 'correlation' | 'estimation',
          };
        }
      }

      onWorkoutSelected(workoutLog);
    } catch (err) {
      console.error('[WorkoutPicker] Error:', err);
      const selectedDay = selectedPlan.days.find((d) => d.id === selectedDayId);
      if (selectedDay) {
        const workoutLog = workoutFromPlanDay(selectedPlan, selectedDay);
        onWorkoutSelected(workoutLog);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlan, selectedDayId, isLoading, onWorkoutSelected]);

  const selectedDay = selectedPlan?.days.find((d) => d.id === selectedDayId);

  // No plans at all
  if (planIds.length === 0) {
    return (
      <div className="px-5 sm:px-7 py-8 border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm font-medium text-[var(--color-text)] mb-1">Start Freeform Workout</p>
          <p className="text-xs text-[var(--color-muted)] mb-3">
            Or create a workout plan for structured training
          </p>
          <button
            onClick={onStartEmpty}
            className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline"
          >
            Continue freeform
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="px-5 sm:px-7 pt-4 pb-4 space-y-3">
        <p className="text-sm font-medium text-[var(--color-text)]">
          What&apos;re we hitting today?
        </p>

        {/* Plan select */}
        <CustomSelect
          label="Plan"
          value={selectedPlanId}
          open={planOpen}
          onToggle={() => { setPlanOpen(!planOpen); setDayOpen(false); }}
          onClose={() => setPlanOpen(false)}
          renderSelected={() => {
            const p = selectedPlanId ? plans[selectedPlanId] : null;
            if (!p) return <span className="text-[var(--color-muted)]">Select...</span>;
            const dayCount = p.days.filter(d => !d.isRestDay).length;
            return (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{p.name}</span>
                {selectedPlanId === activePlanId && (
                  <span className="text-[9px] px-1 py-0.5 bg-[var(--color-lime)]/20 text-[var(--color-lime)] font-medium flex-shrink-0">
                    active
                  </span>
                )}
                <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0">{dayCount}d</span>
              </div>
            );
          }}
        >
          {planIds.map((pid) => {
            const p = plans[pid];
            if (!p) return null;
            const dayCount = p.days.filter(d => !d.isRestDay).length;
            const totalExercises = p.days.reduce((sum, d) => sum + d.exercises.length, 0);
            const isActive = pid === activePlanId;
            const isSelected = pid === selectedPlanId;
            return (
              <button
                key={pid}
                onClick={() => handlePlanChange(pid)}
                className={`w-full text-left px-3 py-2.5 hover:bg-[var(--color-bg)] transition-colors border-b border-[var(--color-line)] last:border-b-0 ${isSelected ? 'bg-[var(--color-bg)]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)] truncate">{p.name}</span>
                  {isActive && (
                    <span className="text-[9px] px-1 py-0.5 bg-[var(--color-lime)]/20 text-[var(--color-lime)] font-medium flex-shrink-0">
                      active
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-lime)] ml-auto flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[var(--color-muted)]">{dayCount} training days</span>
                  <span className="text-[10px] text-[var(--color-muted)]">·</span>
                  <span className="text-[10px] text-[var(--color-muted)]">{totalExercises} exercises</span>
                </div>
              </button>
            );
          })}
        </CustomSelect>

        {/* Day select */}
        {selectedPlan && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <CustomSelect
                label="Day"
                value={selectedDayId}
                open={dayOpen}
                onToggle={() => { setDayOpen(!dayOpen); setPlanOpen(false); }}
                onClose={() => setDayOpen(false)}
                renderSelected={() => {
                  if (!selectedDay) return <span className="text-[var(--color-muted)]">Select...</span>;
                  return (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{selectedDay.name}</span>
                      {selectedDay.id === predictedDay?.id && (
                        <span className="text-[9px] px-1 py-0.5 bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium flex-shrink-0">
                          next up
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0">
                        {selectedDay.exercises.length} ex
                      </span>
                    </div>
                  );
                }}
              >
                {trainingDays.map((day) => {
                  const isSelected = day.id === selectedDayId;
                  const isPredicted = day.id === predictedDay?.id;
                  const lastDone = getLastDoneDate(day, selectedPlan.id, recentWorkouts);
                  return (
                    <button
                      key={day.id}
                      onClick={() => handleDayChange(day.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-[var(--color-bg)] transition-colors border-b border-[var(--color-line)] last:border-b-0 ${isSelected ? 'bg-[var(--color-bg)]' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text)] truncate">{day.name}</span>
                        {isPredicted && (
                          <span className="text-[9px] px-1 py-0.5 bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium flex-shrink-0">
                            next up
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-lime)] ml-auto flex-shrink-0" />}
                      </div>
                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {/* Muscle group badges */}
                        {day.targetMuscles.slice(0, 3).map((mg) => (
                          <span
                            key={mg}
                            className={`text-[9px] px-1 py-0.5 font-medium ${getMuscleGroupColor(mg)}`}
                          >
                            {formatMuscleGroup(mg)}
                          </span>
                        ))}
                        {/* Exercise count */}
                        <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-0.5">
                          <Dumbbell className="w-2.5 h-2.5" />
                          {day.exercises.length}
                        </span>
                        {/* Duration */}
                        {day.estimatedDuration > 0 && (
                          <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {day.estimatedDuration}m
                          </span>
                        )}
                        {/* Last done */}
                        {lastDone && (
                          <span className="text-[10px] text-[var(--color-muted)] ml-auto">
                            {lastDone}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </CustomSelect>
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={!selectedDayId || isLoading}
              className="h-[38px] px-3 bg-[var(--color-lime)] text-[var(--color-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center rounded"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        {/* Start empty link */}
        <button
          onClick={onStartEmpty}
          className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline"
        >
          Start an empty workout
        </button>
      </div>
    </div>
  );
}
