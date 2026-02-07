'use client';

import { useRouter } from 'next/navigation';
import { MealPlanChat, type GeneratedMealPlanData } from '@/components/meal-plans/MealPlanChat';
import { useMealPlansStore } from '@/store/meal-plans.store';
import { BackButton } from '@/components/ui/BackButton';

export default function NewMealPlanPage() {
  const router = useRouter();
  const createMealPlan = useMealPlansStore((s) => s.createMealPlan);

  const handlePlanGenerated = (plan: GeneratedMealPlanData) => {
    const planId = createMealPlan({
      name: plan.name,
      description: plan.description,
      preferences: {
        dietGoal: plan.dietGoal,
        activityLevel: 'moderately_active', // default, refined by chat
        dietStyle: 'flexible',
        mealsPerDay: plan.meals.length,
        weight: plan.bodyStats?.weight,
        weightUnit: (plan.bodyStats?.weightUnit as 'kg' | 'lbs') ?? 'kg',
        height: plan.bodyStats?.height,
        heightUnit: (plan.bodyStats?.heightUnit as 'cm' | 'ft') ?? 'cm',
        age: plan.bodyStats?.age,
        gender: (plan.bodyStats?.gender as 'male' | 'female' | 'other') ?? undefined,
      },
      targets: {
        calories: plan.targets.calories,
        protein: plan.targets.protein,
        carbs: plan.targets.carbs,
        fat: plan.targets.fat,
        fiber: plan.targets.fiber,
      },
      meals: plan.meals,
      tdee: plan.tdee,
      targetCalories: plan.targetCalories,
      proteinPerKg: plan.proteinPerKg,
      rationale: plan.rationale,
    });

    router.push(`/meal-plans/${planId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-10 h-12 flex items-center px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        <span className="text-sm font-medium text-[var(--color-text)]">New Meal Plan</span>
      </header>

      <main className="flex-1 flex flex-col">
        <MealPlanChat
          onPlanGenerated={handlePlanGenerated}
          onCancel={() => router.back()}
        />
      </main>

      <BackButton />
    </div>
  );
}
