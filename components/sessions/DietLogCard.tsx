'use client';

import { useState } from 'react';
import type { DietLog, MealEntry, FoodItem, MealType, Macros } from '@/lib/sessions/types';
import { ChevronDown, ChevronUp, Flame, Beef, Wheat, Droplets } from 'lucide-react';

interface DietLogCardProps {
  dietLog: DietLog | undefined;
  isLoading?: boolean;
}

// Meal type icons and labels
const mealTypeConfig: Record<MealType, { icon: string; label: string }> = {
  breakfast: { icon: '🌅', label: 'Breakfast' },
  morning_snack: { icon: '🍎', label: 'Morning Snack' },
  lunch: { icon: '☀️', label: 'Lunch' },
  afternoon_snack: { icon: '🥜', label: 'Afternoon Snack' },
  dinner: { icon: '🌙', label: 'Dinner' },
  evening_snack: { icon: '🌃', label: 'Evening Snack' },
  pre_workout: { icon: '💪', label: 'Pre-Workout' },
  post_workout: { icon: '🏋️', label: 'Post-Workout' },
  other: { icon: '🍽️', label: 'Other' },
};

// Progress color based on percentage
function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'text-red-600';
  if (percentage >= 90) return 'text-amber-600';
  return 'text-green-600';
}

// Progress bar color
function getProgressBarColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-500';
  if (percentage >= 90) return 'bg-amber-500';
  return 'bg-green-500';
}

// Macro icon row component
function MacroIconRow({ macros, targets, label }: {
  macros: Macros;
  targets?: Macros;
  label?: string;
}) {
  const showProgress = !!targets;

  return (
    <div className="flex items-center gap-4 text-xs">
      {label && (
        <span className="text-[var(--color-muted)] font-medium w-16">{label}</span>
      )}
      <span className="flex items-center gap-1">
        <Flame className="w-3.5 h-3.5 text-orange-500" />
        <span className="font-medium">{Math.round(macros.calories)}</span>
        {showProgress && targets && (
          <span className="text-[var(--color-muted)]">/ {targets.calories}</span>
        )}
        <span className="text-[var(--color-muted)]">cal</span>
      </span>
      <span className="flex items-center gap-1">
        <Beef className="w-3.5 h-3.5 text-red-500" />
        <span className="font-medium">{Math.round(macros.protein)}g</span>
        {showProgress && targets && (
          <span className="text-[var(--color-muted)]">/ {targets.protein}g</span>
        )}
      </span>
      <span className="flex items-center gap-1">
        <Wheat className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-medium">{Math.round(macros.carbs)}g</span>
      </span>
      <span className="flex items-center gap-1">
        <Droplets className="w-3.5 h-3.5 text-yellow-500" />
        <span className="font-medium">{Math.round(macros.fat)}g</span>
      </span>
    </div>
  );
}

// Progress indicator component
function ProgressIndicator({ percentage, label }: { percentage: number; label: string }) {
  const clampedPercentage = Math.min(percentage, 100);
  const colorClass = getProgressBarColor(percentage);

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className={getProgressColor(percentage)}>{Math.round(percentage)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--color-line)] rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-300`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}

// Food item row component
function FoodItemRow({ food }: { food: FoodItem }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex-1 min-w-0">
        <span className="text-[var(--color-text)] truncate block">
          {food.name}
          {food.brand && (
            <span className="text-[var(--color-muted)] text-xs ml-1">({food.brand})</span>
          )}
        </span>
        <span className="text-xs text-[var(--color-muted)]">
          {food.servingSize} {food.servingUnit}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] ml-2">
        <span>{Math.round(food.macros.calories)} cal</span>
        <span>{Math.round(food.macros.protein)}g P</span>
      </div>
    </div>
  );
}

// Meal section component
function MealSection({ meal, isExpanded, onToggle }: {
  meal: MealEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = mealTypeConfig[meal.mealType];

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0">
      {/* Meal header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-[var(--color-surface)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{config.icon}</span>
          <span className="font-medium text-[var(--color-text)]">{config.label}</span>
          {meal.time && (
            <span className="text-xs text-[var(--color-muted)]">{meal.time}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-muted)]">
            {Math.round(meal.totalMacros.calories)} cal | {Math.round(meal.totalMacros.protein)}g P
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
          )}
        </div>
      </button>

      {/* Expanded foods view */}
      {isExpanded && (
        <div className="pb-3 px-1">
          {meal.foods.map(food => (
            <FoodItemRow key={food.id} food={food} />
          ))}
          {meal.notes && (
            <p className="text-xs text-[var(--color-muted)] mt-2 italic">{meal.notes}</p>
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {!isExpanded && meal.foods.length > 0 && (
        <div className="pb-2 px-1">
          <p className="text-xs text-[var(--color-muted)]">
            {meal.foods.slice(0, 3).map(f => f.name).join(', ')}
            {meal.foods.length > 3 && ` +${meal.foods.length - 3} more`}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * DietLogCard - Displays structured diet data with macro tracking
 */
export function DietLogCard({ dietLog, isLoading }: DietLogCardProps) {
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  const toggleMeal = (id: string) => {
    setExpandedMeals(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasData = dietLog && dietLog.meals.length > 0;
  const isEmpty = !dietLog || dietLog.meals.length === 0;

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
          <div className="flex items-center gap-4 text-xs text-[var(--color-muted)] py-2 mb-3">
            <span className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>0 / 2000 cal</span>
            </span>
            <span className="flex items-center gap-1">
              <Beef className="w-3.5 h-3.5 text-red-500" />
              <span>0g / 150g</span>
            </span>
            <span className="flex items-center gap-1">
              <Wheat className="w-3.5 h-3.5 text-amber-600" />
              <span>0g</span>
            </span>
            <span className="flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-yellow-500" />
              <span>0g</span>
            </span>
          </div>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--color-muted)]">Calories</span>
                <span className="text-green-600">0%</span>
              </div>
              <div className="h-1.5 bg-[var(--color-line)] rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--color-muted)]">Protein</span>
                <span className="text-green-600">0%</span>
              </div>
              <div className="h-1.5 bg-[var(--color-line)] rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-muted)] text-center py-4 border-t border-[var(--color-line)]">
            No meals logged yet. Start logging your food below.
          </p>
        </div>
      ) : hasData && dietLog && (
        <div>
          {/* Macro summary with progress */}
          <div className="mb-4">
            <MacroIconRow
              macros={dietLog.summary.progress.consumed}
              targets={dietLog.targets}
            />
          </div>

          {/* Progress bars */}
          <div className="flex gap-4 mb-4">
            <ProgressIndicator
              percentage={dietLog.summary.progress.percentages.calories}
              label="Calories"
            />
            <ProgressIndicator
              percentage={dietLog.summary.progress.percentages.protein}
              label="Protein"
            />
          </div>

          {/* Remaining summary */}
          <div className="text-xs text-[var(--color-muted)] mb-3 pb-3 border-b border-[var(--color-line)]">
            <span className="font-medium">Remaining:</span>{' '}
            {Math.max(0, Math.round(dietLog.summary.progress.remaining.calories))} cal |{' '}
            {Math.max(0, Math.round(dietLog.summary.progress.remaining.protein))}g protein |{' '}
            {Math.max(0, Math.round(dietLog.summary.progress.remaining.carbs))}g carbs |{' '}
            {Math.max(0, Math.round(dietLog.summary.progress.remaining.fat))}g fat
          </div>

          {/* Meals */}
          <div>
            {dietLog.meals.map(meal => (
              <MealSection
                key={meal.id}
                meal={meal}
                isExpanded={expandedMeals.has(meal.id)}
                onToggle={() => toggleMeal(meal.id)}
              />
            ))}
          </div>

          {/* Water intake */}
          {dietLog.waterIntake && dietLog.waterIntake > 0 && (
            <div className="text-xs text-[var(--color-muted)] mt-3 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              Water: {dietLog.waterIntake}ml
            </div>
          )}

          {/* Notes */}
          {dietLog.notes && (
            <p className="text-xs text-[var(--color-muted)] mt-3 italic">
              {dietLog.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
