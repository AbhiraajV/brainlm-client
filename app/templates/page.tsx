'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LayoutGrid, Dumbbell } from 'lucide-react';
import { useTemplatesStore } from '@/store/templates.store';
import { useExercisesStore } from '@/store/exercises.store';
import { useHydrated } from '@/hooks/useHydrated';
import { PlanCard, ExerciseLibrary } from '@/components/templates';
import { BackButton } from '@/components/ui/BackButton';
import { TabBar } from '@/components/ui/TabBar';
import { getKnownExercises } from '@/server/actions/exercise-library.actions';

type Tab = 'plans' | 'exercises';

export default function WorkoutPlansPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const plansMap = useTemplatesStore((s) => s.plans);
  const planIds = useTemplatesStore((s) => s.planIds);
  const plans = useMemo(
    () => planIds.map((id) => plansMap[id]).filter(Boolean),
    [planIds, plansMap]
  );
  const activePlanId = useTemplatesStore((s) => s.activePlanId);
  const deletePlan = useTemplatesStore((s) => s.deletePlan);

  // Seed client exercise registry from server on mount
  const seedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || seedRef.current) return;
    seedRef.current = true;
    getKnownExercises().then((known) => {
      useExercisesStore.getState().seedFromServer(known);
    }).catch(() => {});
  }, [hydrated]);

  const handleDelete = (id: string) => {
    if (confirm('Delete this workout plan?')) {
      deletePlan(id);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <span className="text-sm font-medium text-[var(--color-text)]">Workout Plans</span>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--color-bg)]">
        <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--color-line)]">
          <span className="text-sm font-medium text-[var(--color-text)]">Workout Plans</span>
          {activeTab === 'plans' && (
            <button
              onClick={() => router.push('/templates/new')}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--color-lime)] border border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/10"
            >
              <Plus className="w-3 h-3" />
              New Plan
            </button>
          )}
        </div>

        {/* Tab bar */}
        <TabBar
          tabs={[
            { id: 'plans', label: 'Plans', icon: <LayoutGrid className="w-4 h-4" /> },
            { id: 'exercises', label: 'Exercises', icon: <Dumbbell className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as Tab)}
        />
      </header>

      {/* Content */}
      <main className="flex-1">
        {activeTab === 'plans' ? (
          <>
            {plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 px-4">
                <p className="text-sm text-[var(--color-muted)]">No workout plans</p>
                <p className="text-xs text-[var(--color-muted)]/60 mt-1">
                  Create one to get started
                </p>
                <button
                  onClick={() => router.push('/templates/new')}
                  className="mt-4 flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-lime)] border border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Plan
                </button>
              </div>
            ) : (
              <div>
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onClick={() => router.push(`/templates/${plan.id}`)}
                    onDelete={() => handleDelete(plan.id)}
                    isActive={plan.id === activePlanId}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <ExerciseLibrary />
        )}
      </main>

      <BackButton />
    </div>
  );
}
