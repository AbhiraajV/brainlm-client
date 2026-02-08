'use client';

import { useMemo, useEffect } from 'react';
import { X, RefreshCw, Plus, SkipForward, ArrowUp, ArrowDown } from 'lucide-react';
import { useTemplatesStore } from '@/store/templates.store';
import type { WorkoutLog, TemplateExercise, MuscleGroup } from '@/lib/sessions/types';

interface WorkoutSavePromptProps {
  workoutLog: WorkoutLog;
  onSave: () => void;
  onSkip: () => void;
}

/**
 * Convert workout exercises to template exercises for storing in the plan.
 */
function workoutToTemplateExercises(workoutLog: WorkoutLog): TemplateExercise[] {
  return workoutLog.exercises.map((ex, i) => ({
    id: crypto.randomUUID(),
    exerciseName: ex.exerciseName,
    exerciseRegistryId: ex.exerciseRegistryId,
    globalExerciseId: ex.globalExerciseId,
    muscleGroup: ex.muscleGroup,
    secondaryMuscles: ex.secondaryMuscles,
    equipmentType: ex.equipmentType,
    targetSets: ex.sets.length || 3,
    targetReps: ex.sets.length > 0
      ? Math.round(ex.sets.reduce((sum, s) => sum + s.actualReps, 0) / ex.sets.length)
      : 8,
    targetWeight: ex.sets.length > 0 ? Math.max(...ex.sets.map(s => s.weight)) : undefined,
    targetWeightUnit: ex.sets[0]?.weightUnit ?? workoutLog.preferredUnit,
    orderIndex: i,
  }));
}

export function WorkoutSavePrompt({ workoutLog, onSave, onSkip }: WorkoutSavePromptProps) {
  const store = useTemplatesStore();

  // Mode A: Plan-day session (has templateId + templateDayId)
  const isPlanSession = !!(workoutLog.templateId && workoutLog.templateDayId);

  // Look up original plan day for Mode A
  const originalDay = useMemo(() => {
    if (!isPlanSession) return null;
    const plan = store.plans[workoutLog.templateId!];
    if (!plan) return null;
    return plan.days.find(d => d.id === workoutLog.templateDayId) ?? null;
  }, [isPlanSession, workoutLog.templateId, workoutLog.templateDayId, store.plans]);

  // Compute diff for Mode A
  const diff = useMemo(() => {
    if (!originalDay) return null;

    const planNames = new Set(
      originalDay.exercises.map(e => e.exerciseName.toLowerCase())
    );
    const workoutNames = new Set(
      workoutLog.exercises.map(e => e.exerciseName.toLowerCase())
    );

    const added = workoutLog.exercises
      .filter(e => !planNames.has(e.exerciseName.toLowerCase()))
      .map(e => e.exerciseName);
    const removed = originalDay.exercises
      .filter(e => !workoutNames.has(e.exerciseName.toLowerCase()))
      .map(e => e.exerciseName);

    return { added, removed, hasChanges: added.length > 0 || removed.length > 0 };
  }, [originalDay, workoutLog.exercises]);

  // Mode A: Auto-dismiss if no changes
  useEffect(() => {
    if (isPlanSession && diff && !diff.hasChanges) {
      onSave();
    }
  }, [isPlanSession, diff, onSave]);

  // Mode A: Update routine handler
  const handleUpdateRoutine = () => {
    if (!workoutLog.templateId || !workoutLog.templateDayId) return;
    const templateExercises = workoutToTemplateExercises(workoutLog);
    store.setPlanDayExercises(workoutLog.templateId, workoutLog.templateDayId, templateExercises);
    onSave();
  };

  // Mode B: Freeform — Jaccard matching (existing behavior)
  const bestMatch = useMemo(() => {
    if (isPlanSession) return null; // Skip for plan sessions

    const workoutExIds = new Set(
      workoutLog.exercises.map(e => e.exerciseRegistryId).filter(Boolean)
    );
    if (workoutExIds.size < 3) return null;

    let best: { planId: string; dayId: string; dayName: string; planName: string; overlap: number } | null = null;

    for (const planId of store.planIds) {
      const plan = store.plans[planId];
      if (!plan) continue;
      for (const day of plan.days) {
        if (day.isRestDay || day.exercises.length === 0) continue;
        const dayExIds = new Set(
          day.exercises.map(e => e.exerciseRegistryId).filter(Boolean)
        );
        if (dayExIds.size === 0) continue;
        const intersection = [...workoutExIds].filter(id => dayExIds.has(id)).length;
        const union = new Set([...workoutExIds, ...dayExIds]).size;
        const jaccard = union > 0 ? intersection / union : 0;
        if (jaccard > (best?.overlap ?? 0)) {
          best = { planId, dayId: day.id, dayName: day.name, planName: plan.name, overlap: jaccard };
        }
      }
    }

    return best && best.overlap >= 0.5 ? best : null;
  }, [isPlanSession, workoutLog, store.plans, store.planIds]);

  const handleUpdateFreeformTemplate = () => {
    if (!bestMatch) return;
    const templateExercises = workoutToTemplateExercises(workoutLog);
    store.setPlanDayExercises(bestMatch.planId, bestMatch.dayId, templateExercises);
    onSave();
  };

  const handleCreateNew = () => {
    const templateExercises = workoutToTemplateExercises(workoutLog);
    const muscleGroups = Array.from(new Set(workoutLog.exercises.map(e => e.muscleGroup))) as MuscleGroup[];

    store.createPlan({
      name: workoutLog.workoutName || 'My Workout',
      preferences: {
        trainingGoal: 'general_fitness',
        experienceLevel: 'intermediate',
        equipmentAccess: 'full_gym',
        daysPerWeek: 1,
        sessionDuration: 60,
        focusAreas: muscleGroups,
        deprioritizeAreas: [],
        splitType: 'custom',
        cardioLevel: 'none',
      },
      days: [{
        id: crypto.randomUUID(),
        dayNumber: 1,
        dayLabel: 'Day 1',
        name: workoutLog.workoutName || 'Workout',
        targetMuscles: muscleGroups,
        estimatedDuration: 60,
        exercises: templateExercises,
        isRestDay: false,
        orderIndex: 0,
      }],
    });

    onSave();
  };

  // Mode A with changes: show diff prompt
  if (isPlanSession && diff?.hasChanges) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onSkip} />
        <div className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[var(--color-line)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
            <p className="text-sm font-medium text-[var(--color-text)]">
              Update routine?
            </p>
            <button onClick={onSkip} className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs text-[var(--color-muted)] mb-3">
              Your workout differed from &ldquo;{originalDay?.name}&rdquo;:
            </p>

            <div className="space-y-1.5 mb-4">
              {diff.added.map((name) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <ArrowUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-green-400">Added {name}</span>
                </div>
              ))}
              {diff.removed.map((name) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <ArrowDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-red-400">Removed {name}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleUpdateRoutine}
                className="flex-1 py-2.5 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] rounded transition-colors"
              >
                Update routine
              </button>
              <button
                onClick={onSkip}
                className="flex-1 py-2.5 text-sm font-medium border border-[var(--color-line)] text-[var(--color-text)] rounded hover:bg-[var(--color-bg)] transition-colors"
              >
                Keep as is
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode A with no changes: auto-dismissed via useEffect above, render nothing while waiting
  if (isPlanSession) return null;

  // Mode B: Freeform session — show Jaccard matching options
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onSkip} />
      <div className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[var(--color-line)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
          <p className="text-sm font-medium text-[var(--color-text)]">
            Save to template?
          </p>
          <button onClick={onSkip} className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {bestMatch && (
            <button
              onClick={handleUpdateFreeformTemplate}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-line)] hover:bg-[var(--color-bg)] transition-colors text-left"
            >
              <RefreshCw className="w-5 h-5 text-[var(--color-lime)] flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Update &ldquo;{bestMatch.dayName}&rdquo;
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  in {bestMatch.planName} &middot; {Math.round(bestMatch.overlap * 100)}% match
                </p>
              </div>
            </button>
          )}

          <button
            onClick={handleCreateNew}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-line)] hover:bg-[var(--color-bg)] transition-colors text-left"
          >
            <Plus className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Save as new template</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Creates a new plan from this workout
              </p>
            </div>
          </button>

          <button
            onClick={onSkip}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-line)] hover:bg-[var(--color-bg)] transition-colors text-left"
          >
            <SkipForward className="w-5 h-5 text-[var(--color-muted)] flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Skip</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Just complete the workout
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
