'use client';

import { useState, useEffect } from 'react';
import { CheckSquare, CalendarDays } from 'lucide-react';
import { useTrackerStore, useHabitState } from '@/store/tracker.store';
import { useHydrated } from '@/hooks/useHydrated';
import { useHabitInit } from '@/hooks/useHabitInit';
import { useHabitCompletion } from '@/hooks/useHabitCompletion';
import { SessionInfoCard } from '@/components/sessions/SessionInfoCard';
import { HabitLogCard } from '@/components/sessions/HabitLogCard';
import { HabitCalendarView } from '@/components/sessions/HabitCalendarView';
import { BackButton } from '@/components/ui/BackButton';
import { TabBar } from '@/components/ui/TabBar';

export default function HabitPage() {
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

  return <HabitPageInner />;
}

function HabitPageInner() {
  const hydrated = useHydrated();
  const habitState = useHabitState();

  // Auto-init tracker on mount
  useEffect(() => {
    if (!hydrated) return;
    useTrackerStore.getState().initTracker('habit');
  }, [hydrated]);

  useHabitInit(hydrated);
  const { isCompleting, handleCompleteHabitSession } = useHabitCompletion();

  const [activeTab, setActiveTab] = useState<'habit' | 'history'>('habit');

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!habitState) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] overflow-x-hidden">
      <main className="flex-1 container-padding overflow-x-hidden pb-8">
        {/* Session Info Card */}
        <SessionInfoCard
          trackerType="habit"
          title="Habits"
          hasEvents={!!habitState.habitLog?.entries?.length}
          onComplete={handleCompleteHabitSession}
          isCompleting={isCompleting}
        />

        {/* Tab buttons */}
        <div className="-mx-5 sm:-mx-7 bg-[var(--color-surface)] sticky top-0 z-10">
          <TabBar
            tabs={[
              {
                id: 'habit',
                icon: <CheckSquare className="w-4 h-4" />,
                badge: habitState.habitLog?.entries?.length
                  ? `${habitState.habitLog.summary.completedHabits}/${habitState.habitLog.summary.totalHabits}`
                  : undefined,
              },
              {
                id: 'history',
                icon: <CalendarDays className="w-4 h-4" />,
              },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as typeof activeTab)}
            accentColor="rgb(168,85,247)"
          />
        </div>

        {/* Tab content */}
        <div className="-mx-5 sm:-mx-7 overflow-hidden">
          <div className={activeTab === 'habit' ? 'block' : 'hidden'}>
            <HabitLogCard
              habitLog={habitState.habitLog}
              editable={true}
              onUpdate={(updatedHabitLog) => useTrackerStore.getState().setHabitLog(updatedHabitLog)}
              onComplete={handleCompleteHabitSession}
            />
          </div>

          <div className={activeTab === 'history' ? 'block' : 'hidden'}>
            <HabitCalendarView />
          </div>
        </div>
      </main>

      <BackButton className="
        fixed bottom-6 left-6 z-20
        w-12 h-12 flex items-center justify-center
        bg-[var(--color-surface)] border border-[var(--color-line)]
        rounded-full shadow-lg transition-all duration-200
        hover:shadow-xl hover:border-[var(--color-accent)] active:scale-95
      " />
    </div>
  );
}
