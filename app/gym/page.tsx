'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, MessageSquare, Brain, ClipboardList, ChevronRight } from 'lucide-react';
import { useTrackerStore, useGymState } from '@/store/tracker.store';
import { useHydrated } from '@/hooks/useHydrated';
import { useGymInit } from '@/hooks/useGymInit';
import { useTrackerSubmit } from '@/hooks/useTrackerSubmit';
import { useCoachSubmit } from '@/hooks/useCoachSubmit';
import { useGymCompletion } from '@/hooks/useGymCompletion';
import { SessionInfoCard } from '@/components/sessions/SessionInfoCard';
import { SessionEventInput } from '@/components/sessions/SessionEventInput';
import { WorkoutLogCard } from '@/components/sessions/WorkoutLogCard';
import { GymStartModal } from '@/components/sessions/GymStartModal';
import { PRCelebration } from '@/components/sessions/PRCelebration';
import { ExerciseResolvePopup } from '@/components/sessions/ExerciseResolvePopup';
import { WorkoutSavePrompt } from '@/components/sessions/WorkoutSavePrompt';
import { TrackerInput } from '@/components/sessions/TrackerInput';
import { CoachTab } from '@/components/tracker/CoachTab';
import { InsightsTab } from '@/components/tracker/InsightsTab';
import { BackButton } from '@/components/ui/BackButton';
import { FixedInputContainer } from '@/components/ui/FixedInputContainer';
import { TabBar } from '@/components/ui/TabBar';
import type { MuscleGroup, WorkoutLog } from '@/lib/sessions/types';

export default function GymPage() {
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

  return <GymPageInner />;
}

function GymPageInner() {
  const router = useRouter();
  const hydrated = useHydrated();
  const gymState = useGymState();

  // Auto-init tracker on mount
  useEffect(() => {
    if (!hydrated) return;
    useTrackerStore.getState().initTracker('gym');
  }, [hydrated]);

  const { planContextForCoach } = useGymInit(hydrated);

  const {
    handleSubmit: handleTrackerSubmit,
    isProcessing: trackerProcessing,
    statusMessage: trackerStatus,
    prsDetected,
    setPrsDetected,
    unresolvedExercise,
    setUnresolvedExercise,
  } = useTrackerSubmit({
    trackerType: 'gym',
    planContextForCoach,
  });

  const { handleSubmit: handleCoachSubmit } = useCoachSubmit('gym');

  const {
    isCompleting,
    showSavePrompt,
    setShowSavePrompt,
    handleCompleteGymSession,
    doSaveGymSession,
  } = useGymCompletion();

  const [activeTab, setActiveTab] = useState<'workout' | 'coach' | 'insights'>('workout');
  const [gymWorkoutContext, setGymWorkoutContext] = useState<{ workoutName: string; muscleGroups: MuscleGroup[]; exerciseNames: string[] } | null>(null);
  const [workoutModeChosen, setWorkoutModeChosen] = useState(false);

  // Redirect if not hydrated
  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!gymState) return null;

  return (
    <>
      {/* PR Celebration Banner */}
      {prsDetected.length > 0 && (
        <PRCelebration prs={prsDetected} onDismiss={() => setPrsDetected([])} />
      )}

      {/* Exercise Resolution Popup */}
      {unresolvedExercise && gymState.workoutLog && (
        <ExerciseResolvePopup
          exercise={unresolvedExercise}
          onResolve={(ex, globalId, name, mg, eq) => {
            const updatedExercises = gymState.workoutLog!.exercises.map(e =>
              e.id === ex.id
                ? { ...e, exerciseName: name, globalExerciseId: globalId, muscleGroup: mg, equipmentType: eq, needsResolution: undefined }
                : e
            );
            const updatedWorkout = { ...gymState.workoutLog!, exercises: updatedExercises, updatedAt: new Date().toISOString() };
            useTrackerStore.getState().setWorkoutLog(updatedWorkout);
            const next = updatedExercises.find(e => e.needsResolution);
            setUnresolvedExercise(next ?? null);
          }}
          onCreateCustom={(ex) => {
            const updatedExercises = gymState.workoutLog!.exercises.map(e =>
              e.id === ex.id ? { ...e, needsResolution: undefined } : e
            );
            const updatedWorkout = { ...gymState.workoutLog!, exercises: updatedExercises, updatedAt: new Date().toISOString() };
            useTrackerStore.getState().setWorkoutLog(updatedWorkout);
            const next = updatedExercises.find(e => e.needsResolution);
            setUnresolvedExercise(next ?? null);
          }}
          onDismiss={() => setUnresolvedExercise(null)}
        />
      )}

      {/* Workout Save Prompt */}
      {showSavePrompt && gymState.workoutLog && (
        <WorkoutSavePrompt
          workoutLog={gymState.workoutLog}
          onSave={async () => {
            setShowSavePrompt(false);
            await doSaveGymSession();
          }}
          onSkip={async () => {
            setShowSavePrompt(false);
            await doSaveGymSession();
          }}
        />
      )}

      <div className="min-h-screen flex flex-col bg-[var(--color-bg)] overflow-x-hidden">
        <main className="flex-1 container-padding overflow-x-hidden pb-24">
          {/* Session Info Card */}
          <SessionInfoCard
            trackerType="gym"
            title="Gym"
            knowledge={gymState.knowledge}
            analysis={gymState.analysis}
            hasEvents={!!gymState.workoutLog?.exercises?.length}
            onComplete={handleCompleteGymSession}
            isCompleting={isCompleting}
            gymWorkoutContext={
              gymWorkoutContext ?? (gymState.workoutLog ? {
                workoutName: gymState.workoutLog.workoutName || 'Freeform',
                muscleGroups: gymState.workoutLog.muscleGroups,
                exerciseNames: gymState.workoutLog.exercises.map(e => e.exerciseName),
              } : null)
            }
          />

          {/* Full-screen gym start modal */}
          {!gymState.workoutLog && gymState.events.length === 0 && !workoutModeChosen && (
            <GymStartModal
              sessionId="gym"
              onWorkoutSelected={(log) => {
                useTrackerStore.getState().setWorkoutLog(log);
                setGymWorkoutContext({
                  workoutName: log.workoutName || 'Freeform',
                  muscleGroups: log.muscleGroups,
                  exerciseNames: log.exercises.map(e => e.exerciseName),
                });
              }}
              onStartFreeform={() => {
                setGymWorkoutContext({
                  workoutName: 'Freeform',
                  muscleGroups: [],
                  exerciseNames: [],
                });
                setWorkoutModeChosen(true);
              }}
            />
          )}

          {/* Workout Planner Link */}
          <div className="-mx-5 sm:-mx-7 px-4 py-2 border-b border-[var(--color-line)]">
            <button
              onClick={() => router.push('/templates')}
              className="flex items-center gap-1.5 text-[11px] text-[var(--color-lime)] hover:underline"
            >
              <ClipboardList className="w-3 h-3" />
              <span>Workout Program Planner</span>
              <ChevronRight className="w-3 h-3 text-[var(--color-muted)]" />
            </button>
          </div>

          {/* Tab buttons */}
          <div className="-mx-5 sm:-mx-7 bg-[var(--color-surface)] sticky top-0 z-10">
            <TabBar
              tabs={[
                { id: 'workout', icon: <Dumbbell className="w-4 h-4" />, badge: gymState.workoutLog?.exercises?.length || undefined },
                { id: 'coach', icon: <MessageSquare className="w-4 h-4" />, badge: gymState.events.length > 0 ? gymState.events.length : undefined },
                { id: 'insights', icon: <Brain className="w-4 h-4" /> },
              ]}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as typeof activeTab)}
            />
          </div>

          {/* Tab content */}
          <div className="-mx-5 sm:-mx-7 overflow-hidden">
            <div className={activeTab === 'workout' ? 'block' : 'hidden'}>
              <WorkoutLogCard
                workoutLog={gymState.workoutLog}
                editable={true}
                onUpdate={(updatedWorkout) => useTrackerStore.getState().setWorkoutLog(updatedWorkout)}
              />
            </div>

            <div className={activeTab === 'coach' ? 'block' : 'hidden'}>
              <CoachTab
                trackerType="gym"
                events={gymState.events}
                emptyMessage="Questions, advice, form checks — your coach knows your history"
              />
            </div>

            <div className={activeTab === 'insights' ? 'block' : 'hidden'}>
              <InsightsTab
                analysis={gymState.analysis}
                knowledge={gymState.knowledge}
                emptyLabel="Analysis will appear as you log exercises"
              />
            </div>
          </div>
        </main>

        {/* Fixed input at bottom */}
        <FixedInputContainer>
          {activeTab === 'workout' ? (
            <TrackerInput
              trackerType="gym"
              isProcessing={trackerProcessing}
              onSubmit={handleTrackerSubmit}
              statusMessage={trackerStatus?.message}
              statusType={trackerStatus?.type}
            />
          ) : activeTab === 'coach' ? (
            <SessionEventInput trackerType="gym" onSubmitOverride={handleCoachSubmit} />
          ) : (
            <SessionEventInput trackerType="gym" />
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
