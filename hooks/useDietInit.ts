import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTrackerStore, useDietState } from '@/store/tracker.store';
import { useDietGoalsStore } from '@/store/diet-goals.store';
import { createEmptyDietLog } from '@/lib/diet/macros';
import { fetchRecentDietHistory } from '@/server/actions/diet-history.actions';
import { generateDietDayPlan } from '@/server/actions/diet-daily-plan.actions';
import { computeDietHistorySummary, formatDietHistoryForPrompt, formatDayPlanForPrompt, formatDietProfileForPrompt } from '@/lib/diet/history-utils';
import { generateTodaysMealPlan, type SOSContext } from '@/server/actions/diet-meal-plan.actions';
import type { DietDayPlan, DietHistoryDay, DailyTargets, MealPlanEntry } from '@/lib/sessions/types';

export function useDietInit(hydrated: boolean) {
  const router = useRouter();
  const dietState = useDietState();

  const [dietHistoryContext, setDietHistoryContext] = useState<string | null>(null);
  const [dayPlanContext, setDayPlanContext] = useState<string | null>(null);
  const [dietWeekHistory, setDietWeekHistory] = useState<DietHistoryDay[]>([]);
  const [pendingRecommendation, setPendingRecommendation] = useState<DietDayPlan | null>(null);
  const [mealPlanGenerating, setMealPlanGenerating] = useState(false);

  // Auto-initialize diet log with targets from profile
  useEffect(() => {
    if (!hydrated || !dietState) return;
    if (dietState.dietLog) return;

    const profile = useDietGoalsStore.getState().profile;
    if (!profile?.targets) {
      router.push('/diet-goals');
      return;
    }
    const dietLog = createEmptyDietLog(profile.targets);
    useTrackerStore.getState().setDietLog(dietLog);
  }, [hydrated, dietState, dietState?.dietLog, router]);

  // Fetch diet history + generate recommendation
  const dietPlanInitRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !dietState) return;
    if (dietPlanInitRef.current) return;

    const profile = useDietGoalsStore.getState().profile;
    if (!profile) return;

    if (dietState.dietDayPlan) {
      setDayPlanContext(formatDayPlanForPrompt(dietState.dietDayPlan, profile.targets));
      setDietHistoryContext(formatDietProfileForPrompt(profile));
      dietPlanInitRef.current = true;
      return;
    }

    dietPlanInitRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const history = await fetchRecentDietHistory(14);
        if (cancelled) return;

        setDietWeekHistory(history.slice(0, 7));
        const summary = computeDietHistorySummary(history, profile.targets);
        const histCtx = formatDietHistoryForPrompt(summary, profile.targets);
        const profileCtx = formatDietProfileForPrompt(profile);
        setDietHistoryContext(`${histCtx}\n\n${profileCtx}`);

        const plan = await generateDietDayPlan(profile, history.slice(0, 7));
        if (cancelled) return;
        setPendingRecommendation(plan);
      } catch (err) {
        console.error('[useDietInit] Error:', err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, !!dietState]);

  // Handle today's meal plan generation
  const handleGenerateMealPlan = async (preferences?: string) => {
    if (!dietState || mealPlanGenerating) return;

    setMealPlanGenerating(true);
    try {
      const profile = useDietGoalsStore.getState().profile;
      const targets = dietState.dietDayPlan?.targets ?? dietState.dietLog?.targets ?? profile?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 };

      let sosContext: SOSContext | undefined;
      if (dietState.dietLog && dietState.dietLog.meals.length > 0) {
        const { summary, meals } = dietState.dietLog;
        const now = new Date();
        sosContext = {
          consumedMeals: meals.map(m => ({
            mealType: m.mealType,
            foods: m.foods.map(f => f.name),
            totalCalories: m.totalMacros.calories,
            totalProtein: m.totalMacros.protein,
            totalCarbs: m.totalMacros.carbs,
            totalFat: m.totalMacros.fat,
          })),
          totalConsumed: {
            calories: summary.progress.consumed.calories,
            protein: summary.progress.consumed.protein,
            carbs: summary.progress.consumed.carbs,
            fat: summary.progress.consumed.fat,
          },
          remaining: {
            calories: summary.progress.remaining.calories,
            protein: summary.progress.remaining.protein,
            carbs: summary.progress.remaining.carbs,
            fat: summary.progress.remaining.fat,
          },
          percentages: { ...summary.progress.percentages },
          currentTimeOfDay: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          currentHour: now.getHours(),
          userExplanation: preferences || undefined,
        };
      }

      const result = await generateTodaysMealPlan(
        {
          allergies: profile?.allergies,
          foodPreferences: profile?.foodPreferences,
          mealsPerDay: profile?.mealsPerDay,
          dietGoal: profile?.dietGoal,
          dietStyle: profile?.dietStyle,
        },
        targets,
        sosContext ? undefined : preferences,
        sosContext
      );

      if (result.meals.length > 0) {
        useTrackerStore.getState().setTodaysMealPlan(result.meals, result.analysis);
      }
    } catch (err) {
      console.error('[useDietInit] handleGenerateMealPlan Error:', err);
    } finally {
      setMealPlanGenerating(false);
    }
  };

  // Accept targets handler
  const handleAcceptTargets = (targets: DailyTargets) => {
    const plan = pendingRecommendation ?? {
      targets,
      fiberTarget: targets.fiber ?? 25,
      reasoning: '',
      adjustments: [],
      generatedAt: new Date().toISOString(),
    };
    useTrackerStore.getState().setDietDayPlan({ ...plan, targets });
    // Update diet log targets
    const currentDiet = useTrackerStore.getState().diet;
    if (currentDiet?.dietLog) {
      useTrackerStore.getState().setDietLog({
        ...currentDiet.dietLog,
        targets: { ...targets },
        summary: { ...currentDiet.dietLog.summary, targets: { ...targets } },
        updatedAt: new Date().toISOString(),
      });
    }
    const profile = useDietGoalsStore.getState().profile;
    if (profile) {
      setDayPlanContext(formatDayPlanForPrompt({ ...plan, targets }, profile.targets));
    }
  };

  const handleCustomTargets = (targets: DailyTargets) => {
    const customPlan: DietDayPlan = {
      targets,
      fiberTarget: targets.fiber ?? 25,
      reasoning: 'Custom targets set by user.',
      adjustments: [],
      generatedAt: new Date().toISOString(),
    };
    useTrackerStore.getState().setDietDayPlan(customPlan);
    const currentDiet = useTrackerStore.getState().diet;
    if (currentDiet?.dietLog) {
      useTrackerStore.getState().setDietLog({
        ...currentDiet.dietLog,
        targets: { ...targets },
        summary: { ...currentDiet.dietLog.summary, targets: { ...targets } },
        updatedAt: new Date().toISOString(),
      });
    }
    const profile = useDietGoalsStore.getState().profile;
    if (profile) {
      setDayPlanContext(formatDayPlanForPrompt(customPlan, profile.targets));
    }
  };

  return {
    dietHistoryContext,
    dayPlanContext,
    dietWeekHistory,
    pendingRecommendation,
    mealPlanGenerating,
    handleGenerateMealPlan,
    handleAcceptTargets,
    handleCustomTargets,
  };
}
