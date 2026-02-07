'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { MealPlanEntry, MealType } from '@/lib/sessions/types';

interface MealPlanMealListProps {
  meals: MealPlanEntry[];
}

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  morning_snack: 'Morning Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon Snack',
  dinner: 'Dinner',
  evening_snack: 'Evening Snack',
  pre_workout: 'Pre-Workout',
  post_workout: 'Post-Workout',
  other: 'Other',
};

function MealCard({ meal }: { meal: MealPlanEntry }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--color-bg)] transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text)] truncate">
              {meal.name}
            </span>
            {meal.time && (
              <span className="text-[10px] text-[var(--color-muted)]">{meal.time}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--color-muted)]">
            <span>{mealTypeLabels[meal.mealType]}</span>
            <span className="text-[var(--color-line)]">|</span>
            <span>{Math.round(meal.totalMacros.calories)} cal</span>
            <span className="text-[var(--color-line)]">|</span>
            <span>{Math.round(meal.totalMacros.protein)}P / {Math.round(meal.totalMacros.carbs)}C / {Math.round(meal.totalMacros.fat)}F</span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-3 pl-9">
          {/* Foods */}
          <div className="space-y-1.5">
            {meal.foods.map((food, i) => (
              <div key={i} className="flex items-baseline justify-between text-[12px]">
                <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                  <span className="text-[var(--color-text)]">{food.name}</span>
                  <span className="text-[var(--color-muted)] text-[10px]">{food.portion}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)] ml-2 flex-shrink-0">
                  <span>{food.calories}cal</span>
                  <span>{food.protein}P</span>
                  <span>{food.carbs}C</span>
                  <span>{food.fat}F</span>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {meal.notes && (
            <p className="mt-2 text-[11px] text-[var(--color-muted)] italic">
              {meal.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function MealPlanMealList({ meals }: MealPlanMealListProps) {
  if (meals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <p className="text-sm text-[var(--color-muted)]">No meals in this plan yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)]">
      {meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} />
      ))}
    </div>
  );
}
