'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play } from 'lucide-react';
import { useTemplatesStore, usePlan, usePlanDay } from '@/store/templates.store';
import { useSessionsStore } from '@/store/sessions.store';
import { useHydrated } from '@/hooks/useHydrated';
import { DayEditor } from '@/components/templates';
import { BackButton } from '@/components/ui/BackButton';
import { workoutFromPlanDay } from '@/lib/templates/utils';
import type { MuscleGroup } from '@/lib/sessions/types';

function formatMuscleGroup(mg: MuscleGroup): string {
  return mg.replace(/_/g, ' ');
}

export default function DayEditorPage({ params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id, dayId } = use(params);
  const hydrated = useHydrated();
  const router = useRouter();

  const plan = usePlan(id);
  const day = usePlanDay(id, dayId);
  const setPlanDayExercises = useTemplatesStore((s) => s.setPlanDayExercises);
  const addPlanDayExercise = useTemplatesStore((s) => s.addPlanDayExercise);
  const updatePlanDayExercise = useTemplatesStore((s) => s.updatePlanDayExercise);
  const removePlanDayExercise = useTemplatesStore((s) => s.removePlanDayExercise);
  const incrementPlanUsage = useTemplatesStore((s) => s.incrementPlanUsage);

  const createSession = useSessionsStore((s) => s.createSession);
  const setTrackerType = useSessionsStore((s) => s.setTrackerType);
  const setWorkoutLog = useSessionsStore((s) => s.setWorkoutLog);

  const handleStartWorkout = () => {
    if (!plan || !day) return;
    const sessionId = createSession(day.name, `${plan.name} - ${day.name}`);
    setTrackerType(sessionId, 'gym');
    const workoutLog = workoutFromPlanDay(plan, day);
    setWorkoutLog(sessionId, workoutLog);
    incrementPlanUsage(plan.id);
    router.push(`/sessions/${sessionId}`);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Loading...</div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!plan || !day) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Not found</div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-sm text-[var(--color-text)]">Day not found</p>
          <button
            onClick={() => router.push('/templates')}
            className="mt-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Back to plans
          </button>
        </main>
        <BackButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-12 flex items-center gap-3 px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        <button
          onClick={() => router.push(`/templates/${id}`)}
          className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[var(--color-text)] truncate block">
            {day.dayLabel}: {day.name}
          </span>
        </div>
      </header>

      {/* Day info */}
      <div className="px-4 py-2 border-b border-[var(--color-line)] flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
        {day.targetMuscles.map((mg) => (
          <span key={mg} className="px-1.5 py-0.5 border border-[var(--color-line)]">
            {formatMuscleGroup(mg)}
          </span>
        ))}
        {day.estimatedDuration > 0 && (
          <>
            <span className="text-[var(--color-line)]">|</span>
            <span>~{day.estimatedDuration}min</span>
          </>
        )}
        {day.cardioNotes && (
          <>
            <span className="text-[var(--color-line)]">|</span>
            <span>{day.cardioNotes}</span>
          </>
        )}
      </div>

      {day.description && (
        <div className="px-4 py-2 text-xs text-[var(--color-muted)] border-b border-[var(--color-line)]">
          {day.description}
        </div>
      )}

      {/* Editor */}
      <main className="flex-1">
        <DayEditor
          day={day}
          preferences={plan.preferences}
          allDays={plan.days}
          onSetExercises={(exercises) => setPlanDayExercises(id, dayId, exercises)}
          onAddExercise={(exercise) => addPlanDayExercise(id, dayId, exercise)}
          onUpdateExercise={(exerciseId, updates) => updatePlanDayExercise(id, dayId, exerciseId, updates)}
          onDeleteExercise={(exerciseId) => removePlanDayExercise(id, dayId, exerciseId)}
        />
      </main>

      {/* Spacer for fixed button */}
      <div className="h-24" />

      {/* Start workout button */}
      {day.exercises.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent pt-6">
          <button
            onClick={handleStartWorkout}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 px-4 bg-[var(--color-lime)] text-[var(--color-bg)] font-medium text-sm hover:bg-[var(--color-lime)]/90 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Start This Workout
          </button>
        </div>
      )}

      <BackButton />
    </div>
  );
}
