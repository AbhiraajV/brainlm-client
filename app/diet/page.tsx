'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Utensils, MessageSquare, Brain } from 'lucide-react';
import { useTrackerStore, useDietState } from '@/store/tracker.store';
import { useDietGoalsStore } from '@/store/diet-goals.store';
import { useHydrated } from '@/hooks/useHydrated';
import { useDietInit } from '@/hooks/useDietInit';
import { useTrackerSubmit } from '@/hooks/useTrackerSubmit';
import { useCoachSubmit } from '@/hooks/useCoachSubmit';
import { useDietCompletion } from '@/hooks/useDietCompletion';
import { SessionInfoCard } from '@/components/sessions/SessionInfoCard';
import { SessionEventInput } from '@/components/sessions/SessionEventInput';
import { DietLogCard } from '@/components/sessions/DietLogCard';
import { DietCoachFirstMessage } from '@/components/sessions/DietCoachFirstMessage';
import { TodaysMealPlanCard } from '@/components/sessions/TodaysMealPlanCard';
import { TrackerInput } from '@/components/sessions/TrackerInput';
import { CoachTab } from '@/components/tracker/CoachTab';
import { InsightsTab } from '@/components/tracker/InsightsTab';
import { BackButton } from '@/components/ui/BackButton';
import { FixedInputContainer } from '@/components/ui/FixedInputContainer';
import { TabBar } from '@/components/ui/TabBar';
import type { DailyTargets } from '@/lib/sessions/types';

export default function DietPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-5 sm:px-7 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
          <div className="w-32 h-5 bg-[var(--color-line)] rounded animate-pulse" />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return <DietPageInner />;
}

function DietPageInner() {
  const router = useRouter();
  const hydrated = useHydrated();
  const dietState = useDietState();

  // Auto-init tracker on mount
  useEffect(() => {
    if (!hydrated) return;
    useTrackerStore.getState().initTracker('diet');
  }, [hydrated]);

  const {
    dietHistoryContext,
    dayPlanContext,
    dietWeekHistory,
    pendingRecommendation,
    mealPlanGenerating,
    handleGenerateMealPlan,
    handleAcceptTargets,
    handleCustomTargets,
  } = useDietInit(hydrated);

  const {
    handleSubmit: handleTrackerSubmit,
    isProcessing: trackerProcessing,
    statusMessage: trackerStatus,
  } = useTrackerSubmit({
    trackerType: 'diet',
    dietHistoryContext: dietHistoryContext ?? undefined,
    dayPlanContext: dayPlanContext ?? undefined,
  });

  const { handleSubmit: handleCoachSubmit } = useCoachSubmit('diet');
  const { isCompleting, handleCompleteDietSession } = useDietCompletion();

  const [activeTab, setActiveTab] = useState<'workout' | 'coach' | 'insights'>('workout');

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!dietState) return null;

  const profileTargets = useDietGoalsStore.getState().profile?.targets ?? dietState.dietLog?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 };

  return (
    <>
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)] overflow-x-hidden">
        <main className="flex-1 container-padding overflow-x-hidden pb-24">
          {/* Session Info Card */}
          <SessionInfoCard
            trackerType="diet"
            title="Diet"
            knowledge={dietState.knowledge}
            analysis={dietState.analysis}
            hasEvents={!!dietState.dietLog?.meals?.length}
            onComplete={handleCompleteDietSession}
            isCompleting={isCompleting}
          />

          {/* Diet Goal Planner + Stats Links */}
          <div className="-mx-5 sm:-mx-7 px-4 py-2 border-b border-[var(--color-line)] flex items-center gap-2">
            <button
              onClick={() => router.push('/diet-goals')}
              className="px-3 py-1 text-[11px] font-bold rounded-full border border-[var(--color-lime)] text-[var(--color-lime)] hover:bg-[var(--color-lime)]/10 transition-colors"
            >
              Goals
            </button>
            <button
              onClick={() => router.push('/diet-stats')}
              className="px-3 py-1 text-[11px] font-bold rounded-full border border-orange-400 text-orange-400 hover:bg-orange-400/10 transition-colors"
            >
              Stats
            </button>
            <button
              onClick={() => router.push('/meal-plans')}
              className="px-3 py-1 text-[11px] font-bold rounded-full border border-sky-400 text-sky-400 hover:bg-sky-400/10 transition-colors"
            >
              Meal Plans
            </button>
          </div>

          {/* Tab buttons */}
          <div className="-mx-5 sm:-mx-7 bg-[var(--color-surface)] sticky top-0 z-10">
            <TabBar
              tabs={[
                { id: 'workout', icon: <Utensils className="w-4 h-4" />, badge: dietState.dietLog?.meals?.length || undefined },
                { id: 'coach', icon: <MessageSquare className="w-4 h-4" />, badge: dietState.events.length > 0 ? dietState.events.length : undefined },
                { id: 'insights', icon: <Brain className="w-4 h-4" /> },
              ]}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as typeof activeTab)}
            />
          </div>

          {/* Tab content */}
          <div className="-mx-5 sm:-mx-7 overflow-hidden">
            {/* Diet Tab */}
            <div className={activeTab === 'workout' ? 'block' : 'hidden'}>
              <DietCoachFirstMessage
                recommendation={pendingRecommendation}
                weekHistory={dietWeekHistory}
                profileTargets={profileTargets}
                alreadyAccepted={!!dietState.dietDayPlan}
                onAccept={handleAcceptTargets}
                onCustomTargets={handleCustomTargets}
              />
              <TodaysMealPlanCard
                meals={dietState.todaysMealPlan}
                analysis={dietState.todaysMealPlanAnalysis}
                isGenerating={mealPlanGenerating}
                targetsAccepted={!!dietState.dietDayPlan}
                onGenerate={handleGenerateMealPlan}
                dietLog={dietState.dietLog}
              />
              <DietLogCard
                dietLog={dietState.dietLog}
                editable={true}
                onUpdate={(updatedDiet) => useTrackerStore.getState().setDietLog(updatedDiet)}
              />
            </div>

            {/* Coach Tab */}
            <div className={activeTab === 'coach' ? 'block' : 'hidden'}>
              <CoachTab
                trackerType="diet"
                events={dietState.events}
                emptyMessage="Questions, advice, meal ideas — your coach knows your history"
              />
            </div>

            {/* Insights Tab */}
            <div className={activeTab === 'insights' ? 'block' : 'hidden'}>
              <InsightsTab
                analysis={dietState.analysis}
                knowledge={dietState.knowledge}
                suggestedDiet={undefined}
                emptyLabel="Analysis will appear as you log meals"
              />
            </div>
          </div>
        </main>

        {/* Fixed input at bottom */}
        <FixedInputContainer>
          {activeTab === 'workout' ? (
            <TrackerInput
              trackerType="diet"
              isProcessing={trackerProcessing}
              onSubmit={handleTrackerSubmit}
              statusMessage={trackerStatus?.message}
              statusType={trackerStatus?.type}
            />
          ) : activeTab === 'coach' ? (
            <SessionEventInput trackerType="diet" onSubmitOverride={handleCoachSubmit} />
          ) : (
            <SessionEventInput trackerType="diet" />
          )}
        </FixedInputContainer>

        <BackButton className="
          fixed bottom-20 left-6 z-20
          w-12 h-12 flex items-center justify-center
          bg-[var(--color-surface)] border border-[var(--color-line)]
          rounded-full shadow-lg transition-all duration-200
          hover:shadow-xl hover:border-[var(--color-accent)] active:scale-95
        " />
      </div>
    </>
  );
}
