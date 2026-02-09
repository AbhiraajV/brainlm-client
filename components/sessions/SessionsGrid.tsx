'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Utensils, CheckSquare, Moon, Check, MoreVertical, RefreshCw, Loader2 } from 'lucide-react';
import { useTrackerStore } from '@/store/tracker.store';
import type { TrackerType } from '@/lib/sessions/types';
import { useSleepStore } from '@/store/sleep.store';
import { NavMiniCards } from './NavMiniCards';
import { getGoogleFitStatus, disconnectGoogleFit } from '@/server/actions/google-fit.actions';

interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  trackerType: 'gym' | 'diet' | 'habit' | 'sleep';
  route?: string;
}

export function SessionsGrid() {
  const gymState = useTrackerStore((s) => s.gym);
  const dietState = useTrackerStore((s) => s.diet);
  const habitState = useTrackerStore((s) => s.habit);
  const resetTracker = useTrackerStore((s) => s.resetTracker);
  const router = useRouter();

  const sleepEnabled = useSleepStore((s) => s.enabled);
  const setSleepEnabled = useSleepStore((s) => s.setEnabled);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Google Fit connection state
  const [gfitConnected, setGfitConnected] = useState(false);
  const [gfitLoading, setGfitLoading] = useState(true);
  const [gfitSyncing, setGfitSyncing] = useState(false);

  useEffect(() => {
    getGoogleFitStatus()
      .then((s) => setGfitConnected(s.connected))
      .catch(() => {})
      .finally(() => setGfitLoading(false));
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  // Check if a tracker type has an active (non-completed) state
  const isActive = (type: 'gym' | 'diet' | 'habit') => {
    const state = { gym: gymState, diet: dietState, habit: habitState }[type];
    return !!state && !state.isCompleted;
  };

  // Get session stats for display
  const getSessionStats = (type: 'gym' | 'diet' | 'habit') => {
    if (type === 'gym' && gymState?.workoutLog) {
      const log = gymState.workoutLog;
      return { primary: `${log.summary.totalExercises} exercises`, secondary: `${log.summary.totalSets} sets` };
    }
    if (type === 'diet' && dietState?.dietLog) {
      const log = dietState.dietLog;
      return { primary: `${Math.round(log.summary.progress.consumed.calories)} cal`, secondary: `${Math.round(log.summary.progress.consumed.protein)}g protein` };
    }
    if (type === 'habit' && habitState?.habitLog) {
      const log = habitState.habitLog;
      return { primary: `${log.summary.completedHabits}/${log.summary.totalHabits} done`, secondary: `${log.summary.completionRate}%` };
    }
    return null;
  };

  const handleComplete = (e: React.MouseEvent, type: 'gym' | 'diet' | 'habit') => {
    e.stopPropagation();
    resetTracker(type);
  };

  const handleDelete = (e: React.MouseEvent, type: 'gym' | 'diet' | 'habit') => {
    e.stopPropagation();
    setOpenMenuId(null);
    resetTracker(type);
  };

  const apps: AppConfig[] = [
    {
      id: 'gym', name: 'Gym', description: 'Track workouts & PRs',
      icon: Dumbbell, color: '#ff6b6b', bgGradient: 'rgba(255, 107, 107, 0.2)',
      trackerType: 'gym', route: '/gym',
    },
    {
      id: 'diet', name: 'Diet', description: 'Track meals & macros',
      icon: Utensils, color: '#4ade80', bgGradient: 'rgba(74, 222, 128, 0.2)',
      trackerType: 'diet', route: '/diet',
    },
    {
      id: 'habit', name: 'Habits', description: 'Build daily routines',
      icon: CheckSquare, color: '#c084fc', bgGradient: 'rgba(192, 132, 252, 0.2)',
      trackerType: 'habit', route: '/habit',
    },
    {
      id: 'sleep', name: 'Sleep', description: 'Track sleep quality',
      icon: Moon, color: '#818cf8', bgGradient: 'rgba(129, 140, 248, 0.2)',
      trackerType: 'sleep',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Nav cards first */}
        <NavMiniCards />

        {apps.map((app) => {
          const active = app.trackerType !== 'sleep' && isActive(app.trackerType as 'gym' | 'diet' | 'habit');
          const stats = app.trackerType !== 'sleep' ? getSessionStats(app.trackerType as 'gym' | 'diet' | 'habit') : null;
          const Icon = app.icon;

          return (
            <div
              key={app.id}
              onClick={app.route ? () => router.push(app.route!) : undefined}
              className={`
                relative flex flex-col p-3 sm:p-4
                bg-[var(--color-surface)] rounded-xl
                transition-all duration-200
                ${app.id === 'sleep'
                  ? 'cursor-default border border-[var(--color-line)]'
                  : 'hover:shadow-lg hover:shadow-black/5 cursor-pointer active:scale-[0.98] border'
                }
                group
              `}
              style={
                active
                  ? {
                      borderColor: app.color,
                      boxShadow: `0 0 16px ${app.color}40, 0 0 4px ${app.color}30`,
                    }
                  : app.id !== 'sleep'
                    ? { borderColor: 'var(--color-line)' }
                    : undefined
              }
            >
              {/* Active session action buttons */}
              {active && (
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={(e) => handleComplete(e, app.trackerType as 'gym' | 'diet' | 'habit')}
                    className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                    style={{ backgroundColor: `${app.color}20`, color: app.color }}
                    title="Mark as complete"
                  >
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  </button>

                  <div className="relative" ref={openMenuId === app.id ? menuRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === app.id ? null : app.id);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-bg)] transition-colors text-[var(--color-muted)]"
                      title="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === app.id && (
                      <div className="absolute right-0 top-8 min-w-[160px] py-1 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg shadow-lg z-20">
                        <button
                          onClick={(e) => handleDelete(e, app.trackerType as 'gym' | 'diet' | 'habit')}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-bg)] transition-colors"
                        >
                          Delete this session
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Icon */}
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl mb-2 transition-transform group-hover:scale-105"
                style={{ backgroundColor: app.bgGradient }}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: app.color }} />
              </div>

              {/* Title & Description */}
              <h3 className="font-semibold text-[var(--color-text)] text-sm sm:text-base leading-tight">{app.name}</h3>
              <p className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-snug">{app.description}</p>

              {/* Status */}
              <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
                {app.id === 'sleep' ? (
                  <div className="flex items-center justify-between">
                    {sleepEnabled ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: app.color }} />
                        <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: app.color }}>Active</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">Off</span>
                    )}
                    <div
                      onClick={(e) => { e.stopPropagation(); setSleepEnabled(!sleepEnabled); }}
                      role="switch"
                      aria-checked={sleepEnabled}
                      className="cursor-pointer"
                      style={{
                        position: 'relative', width: 36, height: 20, borderRadius: 10,
                        backgroundColor: sleepEnabled ? app.color : 'var(--color-line)',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 8,
                        backgroundColor: '#fff',
                        transform: sleepEnabled ? 'translateX(16px)' : 'translateX(0)',
                        transition: 'transform 0.2s',
                      }} />
                    </div>
                  </div>
                ) : active ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: app.color }} />
                      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: app.color }}>Active</span>
                    </div>
                    {stats && (
                      <span className="text-xs text-[var(--color-muted)]">{stats.primary}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">Start</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Google Fit card */}
        <div
          onClick={!gfitConnected && !gfitLoading ? () => { window.location.href = '/api/google-fit/auth'; } : undefined}
          className={`
            relative flex flex-col p-3 sm:p-4
            bg-[var(--color-surface)] rounded-xl
            transition-all duration-200
            ${gfitConnected ? 'cursor-default' : 'hover:shadow-lg hover:shadow-black/5 cursor-pointer active:scale-[0.98]'}
            border group
          `}
          style={
            gfitConnected
              ? { borderColor: '#4285F4', boxShadow: '0 0 16px #4285F440, 0 0 4px #4285F430' }
              : { borderColor: 'var(--color-line)' }
          }
        >
          {gfitConnected && (
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setGfitSyncing(true);
                  setTimeout(() => setGfitSyncing(false), 1500);
                }}
                disabled={gfitSyncing}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                style={{ backgroundColor: '#4285F420', color: '#4285F4' }}
                title="Sync data"
              >
                {gfitSyncing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
              </button>

              <div className="relative" ref={openMenuId === 'gfit' ? menuRef : undefined}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === 'gfit' ? null : 'gfit');
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-bg)] transition-colors text-[var(--color-muted)]"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {openMenuId === 'gfit' && (
                  <div className="absolute right-0 top-8 min-w-[160px] py-1 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg shadow-lg z-20">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        await disconnectGoogleFit();
                        setGfitConnected(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-bg)] transition-colors"
                    >
                      Disconnect Google Fit
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl mb-2 transition-transform group-hover:scale-105"
            style={{ backgroundColor: 'rgba(66, 133, 244, 0.15)' }}
          >
            <GoogleFitIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <h3 className="font-semibold text-[var(--color-text)] text-sm sm:text-base leading-tight">Google Fit</h3>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-snug">Import health data</p>

          <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
            {gfitLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-[var(--color-muted)]" />
            ) : gfitConnected ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4] animate-pulse" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-[#4285F4]">Connected</span>
              </div>
            ) : (
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">Connect</span>
            )}
          </div>
        </div>

      </div>

      {/* Quick tip */}
      <div className="mt-4 p-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-line)]">
        <p className="text-xs text-[var(--color-muted)] text-center">
          Tap an app to start tracking. Your AI coach will guide you.
        </p>
      </div>
    </>
  );
}

function GoogleFitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
      <path d="M67.987 96.001l-8.49-8.49c-9.164-9.164-9.164-24.023 0-33.186l25.469-25.47c9.164-9.163 24.023-9.163 33.186 0l25.47 25.47-33.19 33.187-8.49-8.49 24.7-24.697c-5.69-5.69-14.917-5.69-20.607 0l-25.47 25.47c-5.689 5.69-5.689 14.916 0 20.606l8.49 8.49z" fill="#EA4335" />
      <path d="M96 124.013l8.49 8.49c9.164 9.164 9.164 24.023 0 33.187l-.353.352c-9.163 9.164-24.023 9.164-33.186 0l-.354-.353c-9.163-9.164-9.163-24.023 0-33.186l8.49-8.49 8.456 8.523-8.456 8.457c-5.69 5.689-5.69 14.916 0 20.606l.353.354c5.69 5.689 14.917 5.689 20.607 0l.353-.354c5.69-5.69 5.69-14.917 0-20.606l-8.49-8.49z" fill="#FBBC04" />
      <path d="M124.013 96.001l8.49-8.49c9.164-9.165 24.023-9.165 33.187 0l.352.353c9.164 9.163 9.164 24.023 0 33.186l-.353.354c-9.164 9.163-24.023 9.163-33.186 0l-8.49-8.49 8.523-8.457 8.457 8.457c5.689 5.689 14.916 5.689 20.606 0l.354-.354c5.689-5.69 5.689-14.917 0-20.607l-.354-.353c-5.69-5.69-14.917-5.69-20.606 0l-8.49 8.49z" fill="#4285F4" />
      <path d="M96 67.988l-8.49 8.49-8.456-8.523 8.456-8.457c5.69-5.689 5.69-14.916 0-20.606l-.353-.354c-5.69-5.689-14.917-5.689-20.607 0l-.353.354c-5.69 5.69-5.69 14.917 0 20.607l33.186 33.186 8.49-8.49-24.696-24.697c-5.69-5.69-5.69-14.917 0-20.607l.353-.353c9.163-9.164 24.023-9.164 33.186 0l.354.353c9.163 9.163 9.163 24.023 0 33.186z" fill="#34A853" />
    </svg>
  );
}
