'use client';

import { useState } from 'react';
import type { MealPlanEntry, Macros, MealType, DietLog } from '@/lib/sessions/types';
import { ChevronDown, ChevronRight, Loader2, Sparkles, Flame, Beef, Wheat, Droplets, LifeBuoy } from 'lucide-react';

interface TodaysMealPlanCardProps {
  meals: MealPlanEntry[] | undefined;
  analysis: string | undefined;
  isGenerating: boolean;
  targetsAccepted: boolean;
  onGenerate: (preferences?: string) => void;
  dietLog?: DietLog;
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

function MacroRow({ macros, size = 'sm' }: { macros: Macros; size?: 'sm' | 'xs' }) {
  const textClass = size === 'sm' ? 'text-xs' : 'text-[10px]';
  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  return (
    <div className={`flex items-center gap-3 ${textClass} text-[var(--color-muted)]`}>
      <span className="flex items-center gap-1">
        <Flame className={`${iconClass} text-orange-500`} />
        <span className="font-medium text-[var(--color-text)]">{Math.round(macros.calories)}</span>
      </span>
      <span className="flex items-center gap-1">
        <Beef className={`${iconClass} text-red-500`} />
        <span className="font-medium text-[var(--color-text)]">{Math.round(macros.protein)}g</span>
      </span>
      <span className="flex items-center gap-1">
        <Wheat className={`${iconClass} text-amber-600`} />
        <span className="font-medium text-[var(--color-text)]">{Math.round(macros.carbs)}g</span>
      </span>
      <span className="flex items-center gap-1">
        <Droplets className={`${iconClass} text-yellow-500`} />
        <span className="font-medium text-[var(--color-text)]">{Math.round(macros.fat)}g</span>
      </span>
    </div>
  );
}

function RemainingBudgetBar({ dietLog }: { dietLog: DietLog }) {
  const { progress } = dietLog.summary;
  const calPct = Math.min(progress.percentages.calories, 100);
  const isOver = progress.remaining.calories <= 0;

  return (
    <div className="space-y-2">
      {/* Calories progress bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-[var(--color-muted)]">
            {Math.round(progress.consumed.calories)} / {dietLog.targets.calories} cal
          </span>
          <span className={`font-medium ${isOver ? 'text-red-400' : 'text-amber-400'}`}>
            {isOver ? `${Math.abs(Math.round(progress.remaining.calories))} over` : `${Math.round(progress.remaining.calories)} left`}
          </span>
        </div>
        <div className="h-2 bg-[var(--color-line)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(calPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Remaining P/C/F */}
      <div className="flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          <Beef className="w-2.5 h-2.5 text-red-500" />
          <span className={progress.remaining.protein <= 0 ? 'text-red-400' : ''}>
            {Math.round(progress.remaining.protein)}g P left
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Wheat className="w-2.5 h-2.5 text-amber-600" />
          <span>{Math.round(progress.remaining.carbs)}g C left</span>
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="w-2.5 h-2.5 text-yellow-500" />
          <span>{Math.round(progress.remaining.fat)}g F left</span>
        </span>
      </div>
    </div>
  );
}

function MealSection({ meal }: { meal: MealPlanEntry }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 py-2.5 px-4 text-left hover:bg-[var(--color-bg)] transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)] flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--color-text)] truncate">{meal.name}</span>
            {meal.time && (
              <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0">{meal.time}</span>
            )}
          </div>
          <MacroRow macros={meal.totalMacros} size="xs" />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-3 pl-10">
          <div className="space-y-1.5">
            {meal.foods.map((food, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[var(--color-text)]">{food.name}</span>
                  <span className="text-[var(--color-muted)] text-[10px] flex-shrink-0">{food.portion}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)] flex-shrink-0 ml-2">
                  <span className="flex items-center gap-0.5"><Flame className="w-2.5 h-2.5 text-orange-500" />{food.calories}</span>
                  <span className="flex items-center gap-0.5"><Beef className="w-2.5 h-2.5 text-red-500" />{food.protein}g</span>
                  <span className="flex items-center gap-0.5"><Wheat className="w-2.5 h-2.5 text-amber-600" />{food.carbs}g</span>
                  <span className="flex items-center gap-0.5"><Droplets className="w-2.5 h-2.5 text-yellow-500" />{food.fat}g</span>
                </div>
              </div>
            ))}
          </div>
          {meal.notes && (
            <div className="mt-2 text-[11px] text-[var(--color-muted)] italic">{meal.notes}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function TodaysMealPlanCard({
  meals,
  analysis,
  isGenerating,
  targetsAccepted,
  onGenerate,
  dietLog,
}: TodaysMealPlanCardProps) {
  const [preferences, setPreferences] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [sosExpanded, setSosExpanded] = useState(false);
  const [sosExplanation, setSosExplanation] = useState('');

  const hasFoodLogged = (dietLog?.meals?.length ?? 0) > 0;

  // Don't show until targets are accepted
  if (!targetsAccepted) return null;

  // Already generated — show the plan
  if (meals && meals.length > 0) {
    const dailyTotals: Macros = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.totalMacros.calories,
        protein: acc.protein + m.totalMacros.protein,
        carbs: acc.carbs + m.totalMacros.carbs,
        fat: acc.fat + m.totalMacros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return (
      <div className="border-b border-[var(--color-line)]">
        {/* Header */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[12px] font-medium text-[var(--color-text)]">Today&apos;s Meal Plan</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onGenerate(preferences || undefined)}
              disabled={isGenerating}
              className="flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Regenerate
            </button>
            <button
              onClick={() => setSosExpanded(!sosExpanded)}
              disabled={isGenerating}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
            >
              <LifeBuoy className="w-3 h-3" />
              SOS
            </button>
          </div>
        </div>

        {/* SOS Expanded Inline */}
        {sosExpanded && (
          <div className="px-4 pb-3 space-y-2 border-b border-[var(--color-line)]">
            {hasFoodLogged && dietLog && <RemainingBudgetBar dietLog={dietLog} />}
            <input
              type="text"
              value={sosExplanation}
              onChange={(e) => setSosExplanation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onGenerate(sosExplanation || undefined); setSosExpanded(false); } }}
              placeholder="What happened? (optional)"
              className="w-full px-3 py-2 text-[13px] bg-transparent border border-amber-500/30 focus:outline-none focus:border-amber-400/50 text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
            />
            <button
              onClick={() => { onGenerate(sosExplanation || undefined); setSosExpanded(false); }}
              disabled={isGenerating}
              className="w-full py-2 text-[13px] font-medium bg-amber-500 text-black flex items-center justify-center gap-1.5 hover:bg-amber-400 transition-colors"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Rescue My Day
            </button>
          </div>
        )}

        {/* Daily totals */}
        <div className="px-4 pb-2">
          <MacroRow macros={dailyTotals} />
        </div>

        {/* Meals */}
        <div>
          {meals.map((meal) => (
            <MealSection key={meal.id} meal={meal} />
          ))}
        </div>

        {/* Analysis */}
        {analysis && (
          <div className="border-t border-[var(--color-line)]">
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="w-full flex items-center gap-2 py-2 px-4 text-left hover:bg-[var(--color-bg)] transition-colors"
            >
              {showAnalysis ? (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]" />
              )}
              <span className="text-[11px] text-[var(--color-muted)]">Why this plan?</span>
            </button>
            {showAnalysis && (
              <div className="px-4 pb-3 pl-10 text-[12px] text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">
                {analysis}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Generating — show loader
  if (isGenerating) {
    return (
      <div className="px-4 py-6 border-b border-[var(--color-line)] flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
        <span className="text-[12px] text-[var(--color-muted)]">
          {hasFoodLogged ? 'Figuring out how to save your day...' : 'Generating your meal plan...'}
        </span>
      </div>
    );
  }

  // Skipped — don't show anything
  if (skipped) return null;

  // Food logged but no plan yet — SOS pre-generation mode (collapsed by default)
  if (hasFoodLogged && dietLog) {
    return (
      <div className="px-4 py-3 border-b border-[var(--color-line)] space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSosExpanded(!sosExpanded)}
            className="flex-1 flex items-center gap-2 text-left"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[12px] font-medium text-amber-400">SOS — rescue the rest of your day</span>
          </button>
          <button
            onClick={() => setSkipped(true)}
            className="px-2 py-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors flex-shrink-0"
          >
            Skip
          </button>
        </div>
        {sosExpanded && (
          <div className="space-y-2">
            <RemainingBudgetBar dietLog={dietLog} />
            <input
              type="text"
              value={sosExplanation}
              onChange={(e) => setSosExplanation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onGenerate(sosExplanation || undefined); }}
              placeholder="What happened? (e.g., had pizza for lunch)"
              className="w-full px-3 py-2 text-[13px] bg-transparent border border-amber-500/30 focus:outline-none focus:border-amber-400/50 text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
            />
            <button
              onClick={() => onGenerate(sosExplanation || undefined)}
              className="w-full py-2 text-[13px] font-medium bg-amber-500 text-black flex items-center justify-center gap-1.5 hover:bg-amber-400 transition-colors"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Rescue My Day
            </button>
          </div>
        )}
      </div>
    );
  }

  // No food logged — standard preference input
  return (
    <div className="px-4 py-3 border-b border-[var(--color-line)] space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-[12px] font-medium text-[var(--color-text)]">Generate today&apos;s meal plan?</span>
      </div>
      <input
        type="text"
        value={preferences}
        onChange={(e) => setPreferences(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onGenerate(preferences || undefined); }}
        placeholder="Any requests? (e.g., high protein breakfast, easy lunch)"
        className="w-full px-3 py-2 text-[13px] bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-sky-400/50 text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => onGenerate(preferences || undefined)}
          className="flex-1 py-2 text-[13px] font-medium bg-sky-500 text-white flex items-center justify-center gap-1.5 hover:bg-sky-600 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate Plan
        </button>
        <button
          onClick={() => setSkipped(true)}
          className="px-4 py-2 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
