'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkoutQuestionnaire } from '@/components/templates';
import { useTemplatesStore } from '@/store/templates.store';
import { generateWorkoutPlan } from '@/server/actions/template-suggestion.actions';
import { BackButton } from '@/components/ui/BackButton';
import type { WorkoutPreferences, PlanDay, SplitType } from '@/lib/sessions/types';

export default function NewPlanPage() {
  const router = useRouter();
  const createPlan = useTemplatesStore((s) => s.createPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (preferences: WorkoutPreferences) => {
    setIsGenerating(true);
    setError(null);

    try {
      const { plan, error: genError } = await generateWorkoutPlan(preferences);

      if (genError || !plan) {
        setError(genError || 'Failed to generate plan');
        setIsGenerating(false);
        return;
      }

      const days: PlanDay[] = plan.days.map((d, i) => ({
        id: crypto.randomUUID(),
        dayNumber: d.dayNumber,
        dayLabel: d.dayLabel,
        name: d.name,
        description: d.description,
        targetMuscles: d.targetMuscles,
        estimatedDuration: d.estimatedDuration,
        exercises: [],
        isRestDay: d.isRestDay,
        isCardioDay: d.isCardioDay,
        cardioNotes: d.cardioNotes,
        orderIndex: i,
      }));

      const planId = createPlan({
        name: plan.name,
        description: plan.description,
        preferences,
        days,
      });

      router.push(`/templates/${planId}`);
    } catch {
      setError('Something went wrong');
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-10 h-12 flex items-center px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        <span className="text-sm font-medium text-[var(--color-text)]">New Workout Plan</span>
      </header>

      <main className="flex-1 flex flex-col">
        <WorkoutQuestionnaire onComplete={handleComplete} isGenerating={isGenerating} />
      </main>

      {error && (
        <div className="px-4 py-2 text-xs text-[var(--color-coral)] text-center">
          {error}
        </div>
      )}

      <BackButton />
    </div>
  );
}
