'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Utensils, CheckSquare, Brain, Moon, Heart, X, Sparkles } from 'lucide-react';
import { useSessionsStore, selectSessions } from '@/store/sessions.store';
import type { TrackerType } from '@/lib/sessions/types';
import { useHydrated } from '@/hooks/useHydrated';
import { SessionModal, type QuickSessionType } from '@/components/sessions/SessionModal';
import { BackButton } from '@/components/ui/BackButton';
import { useSleepStore } from '@/store/sleep.store';

interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  trackerType: TrackerType | 'habit';
  comingSoon?: boolean;
  onClick?: () => void;
}

export default function SessionsPage() {
  const hydrated = useHydrated();
  const allSessions = useSessionsStore(selectSessions);
  const sessions = allSessions.filter(s => !s.isCompleted);
  const createSession = useSessionsStore((s) => s.createSession);
  const setTrackerType = useSessionsStore((s) => s.setTrackerType);
  const deleteSession = useSessionsStore((s) => s.deleteSession);
  const router = useRouter();

  const sleepEnabled = useSleepStore((s) => s.enabled);
  const setSleepEnabled = useSleepStore((s) => s.setEnabled);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickType, setQuickType] = useState<QuickSessionType | undefined>(undefined);

  // Find active sessions for each app type
  const findActiveSession = (type: TrackerType | 'habit') => {
    const today = new Date().toDateString();
    return sessions.find(
      (s) =>
        s.trackerType === type &&
        new Date(s.createdAt).toDateString() === today &&
        !s.isCompleted
    );
  };

  // Get session stats for display
  const getSessionStats = (type: TrackerType | 'habit') => {
    const session = findActiveSession(type);
    if (!session) return null;

    if (type === 'gym' && session.workoutLog) {
      const log = session.workoutLog;
      return {
        primary: `${log.summary.totalExercises} exercises`,
        secondary: `${log.summary.totalSets} sets`
      };
    }

    if (type === 'diet' && session.dietLog) {
      const log = session.dietLog;
      return {
        primary: `${Math.round(log.summary.progress.consumed.calories)} cal`,
        secondary: `${Math.round(log.summary.progress.consumed.protein)}g protein`
      };
    }

    if (type === 'habit' && session.habitLog) {
      const log = session.habitLog;
      return {
        primary: `${log.summary.completedHabits}/${log.summary.totalHabits} done`,
        secondary: `${log.summary.completionRate}%`
      };
    }

    return { primary: 'In progress', secondary: '' };
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setQuickType(undefined);
  };

  const handleSessionCreated = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  // App configurations
  const apps: AppConfig[] = [
    {
      id: 'gym',
      name: 'Gym',
      description: 'Track workouts & PRs',
      icon: Dumbbell,
      color: '#f87171',
      bgGradient: 'rgba(248, 113, 113, 0.15)',
      trackerType: 'gym',
      onClick: () => {
        const active = findActiveSession('gym');
        if (active) {
          router.push(`/sessions/${active.id}`);
          return;
        }
        const newId = createSession('Gym App', 'Track workouts, PRs, and become your best self');
        setTrackerType(newId, 'gym' as TrackerType);
        router.push(`/sessions/${newId}`);
      }
    },
    {
      id: 'diet',
      name: 'Diet',
      description: 'Track meals & macros',
      icon: Utensils,
      color: '#34d399',
      bgGradient: 'rgba(52, 211, 153, 0.15)',
      trackerType: 'diet',
      onClick: () => {
        const active = findActiveSession('diet');
        if (active) {
          router.push(`/sessions/${active.id}`);
          return;
        }
        const newId = createSession('Diet Tracker', 'Track meals and stay on target');
        setTrackerType(newId, 'diet' as TrackerType);
        router.push(`/sessions/${newId}`);
      }
    },
    {
      id: 'habit',
      name: 'Habits',
      description: 'Build daily routines',
      icon: CheckSquare,
      color: '#a855f7',
      bgGradient: 'rgba(168, 85, 247, 0.15)',
      trackerType: 'habit',
      onClick: () => {
        const active = findActiveSession('habit');
        if (active) {
          router.push(`/sessions/${active.id}`);
          return;
        }
        const newId = createSession('Habit Tracker', 'Track daily habits and build consistency');
        setTrackerType(newId, 'habit' as TrackerType);
        router.push(`/sessions/${newId}`);
      }
    },
    {
      id: 'sleep',
      name: 'Sleep',
      description: 'Track sleep quality',
      icon: Moon,
      color: '#6366f1',
      bgGradient: 'rgba(99, 102, 241, 0.15)',
      trackerType: 'sleep',
    },
    {
      id: 'mood',
      name: 'Mood',
      description: 'Track emotions',
      icon: Heart,
      color: '#ec4899',
      bgGradient: 'rgba(236, 72, 153, 0.15)',
      trackerType: 'general',
      comingSoon: true
    },
    {
      id: 'focus',
      name: 'Focus',
      description: 'Deep work sessions',
      icon: Brain,
      color: '#f59e0b',
      bgGradient: 'rgba(245, 158, 11, 0.15)',
      trackerType: 'general',
      comingSoon: true
    }
  ];

  const handleDelete = (e: React.MouseEvent, type: TrackerType | 'habit') => {
    e.stopPropagation();
    const session = findActiveSession(type);
    if (session) {
      deleteSession(session.id);
    }
  };

  // Loading state
  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-5 sm:px-7 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
          <div className="font-serif font-semibold text-lg text-[var(--color-text)]">Apps</div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        {/* Header */}
        <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-3 sm:px-4 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
          <div className="font-serif font-semibold text-base text-[var(--color-text)]">Apps</div>
          <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
        </header>

        {/* App Grid */}
        <main className="flex-1 px-2 pt-2 sm:px-3 sm:pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {apps.map((app) => {
              const activeSession = findActiveSession(app.trackerType);
              const stats = getSessionStats(app.trackerType);
              const Icon = app.icon;

              return (
                <div
                  key={app.id}
                  onClick={app.comingSoon ? undefined : app.id === 'sleep' ? undefined : app.onClick}
                  className={`
                    relative flex flex-col p-3 sm:p-4
                    bg-[var(--color-surface)] rounded-xl
                    border border-[var(--color-line)]
                    transition-all duration-200
                    ${app.comingSoon
                      ? 'opacity-50 cursor-not-allowed'
                      : app.id === 'sleep'
                        ? 'cursor-default'
                        : 'hover:border-[var(--color-muted)] hover:shadow-lg hover:shadow-black/5 cursor-pointer active:scale-[0.98]'
                    }
                    group
                  `}
                >
                  {/* Active indicator & delete button */}
                  {activeSession && !app.comingSoon && (
                    <button
                      onClick={(e) => handleDelete(e, app.trackerType)}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-error)]/20 transition-colors opacity-0 group-hover:opacity-100"
                      title="End session"
                    >
                      <X className="w-3.5 h-3.5 text-[var(--color-error)]" />
                    </button>
                  )}

                  {/* Icon */}
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl mb-2 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: app.bgGradient }}
                  >
                    <Icon
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      style={{ color: app.color }}
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-semibold text-[var(--color-text)] text-sm sm:text-base leading-tight">
                    {app.name}
                  </h3>
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-snug">
                    {app.description}
                  </p>

                  {/* Status */}
                  <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
                    {app.id === 'sleep' ? (
                      <div className="flex items-center justify-between">
                        {sleepEnabled ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: app.color }} />
                            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: app.color }}>
                              Active
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                            Off
                          </span>
                        )}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSleepEnabled(!sleepEnabled);
                          }}
                          role="switch"
                          aria-checked={sleepEnabled}
                          className="cursor-pointer"
                          style={{
                            position: 'relative',
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: sleepEnabled ? app.color : 'var(--color-line)',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: '#fff',
                              transform: sleepEnabled ? 'translateX(16px)' : 'translateX(0)',
                              transition: 'transform 0.2s',
                            }}
                          />
                        </div>
                      </div>
                    ) : app.comingSoon ? (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                        Coming Soon
                      </span>
                    ) : activeSession ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: app.color }} />
                          <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: app.color }}>
                            Active
                          </span>
                        </div>
                        {stats && (
                          <span className="text-xs text-[var(--color-muted)]">
                            {stats.primary}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                        Start
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick tip */}
          <div className="mt-4 p-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-line)]">
            <p className="text-xs text-[var(--color-muted)] text-center">
              Tap an app to start tracking. Your AI coach will guide you.
            </p>
          </div>
        </main>

        {/* Fixed back button */}
        <BackButton />
      </div>

      <SessionModal
        isOpen={isModalOpen}
        quickType={quickType}
        onClose={handleCloseModal}
        onCreated={handleSessionCreated}
      />
    </>
  );
}
