'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useTemplatesStore, usePlan, usePlanDay } from '@/store/templates.store';
import { useHydrated } from '@/hooks/useHydrated';
import { DayEditor } from '@/components/templates';
import { BackButton } from '@/components/ui/BackButton';
import { getMuscleGroupColor, formatMuscleGroup } from '@/lib/gym/muscle-groups';

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

  const [detailsOpen, setDetailsOpen] = useState(false);

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
      {/* Compact header: back + title + collapsible details */}
      <header className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-line)]">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <button
            onClick={() => router.push(`/templates/${id}`)}
            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <span className="text-[10px] font-bold text-[var(--color-lime)] uppercase shrink-0">
              {day.dayLabel}
            </span>
            <span className="text-base font-bold text-[var(--color-text)] truncate">
              {day.name}
            </span>
            {detailsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
            )}
          </button>
        </div>

        {/* Muscle tags — always visible */}
        {day.targetMuscles.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
            {day.targetMuscles.map((mg) => (
              <span
                key={mg}
                className={`text-[10px] px-1.5 py-0.5 rounded-sm ${getMuscleGroupColor(mg)}`}
              >
                {formatMuscleGroup(mg)}
              </span>
            ))}
            {day.estimatedDuration > 0 && (
              <span className="text-[10px] text-[var(--color-muted)] ml-1">
                ~{day.estimatedDuration}min
              </span>
            )}
          </div>
        )}

        {/* Expandable details */}
        {detailsOpen && (
          <div className="border-t border-[var(--color-line)] px-4 py-2 space-y-1">
            {day.description && (
              <p className="text-xs text-[var(--color-muted)]">{day.description}</p>
            )}
            {day.cardioNotes && (
              <p className="text-xs text-[var(--color-muted)]">Cardio: {day.cardioNotes}</p>
            )}
            {!day.description && !day.cardioNotes && (
              <p className="text-xs text-[var(--color-muted)]/50">No additional details</p>
            )}
          </div>
        )}
      </header>

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

      {/* Spacer */}
      <div className="h-20" />

      <BackButton />
    </div>
  );
}
