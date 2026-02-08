'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Check, Loader2, ChevronDown, Dumbbell, Clock, ArrowRight, Zap, Sparkles, X } from 'lucide-react';
import { useTemplatesStore } from '@/store/templates.store';
import { getRecentWorkouts } from '@/server/actions/gym-history.actions';
import { formatMuscleGroup, getMuscleGroupColor, getBroadGroup } from '@/lib/gym/muscle-groups';
import { predictNextPlanDay, getLastDoneDate, resolvePlanDayToWorkoutLog } from '@/lib/gym/workout-prediction';
import { workoutFromPlanDay } from '@/lib/templates/utils';
import { QuickAIPanel } from './QuickAIPanel';
import type { WorkoutLog, WorkoutPlan, PlanDay, MuscleGroup } from '@/lib/sessions/types';
import type { WorkoutSummary } from '@/server/actions/gym-history.actions';

interface GymStartModalProps {
  sessionId: string;
  onWorkoutSelected: (log: WorkoutLog) => void;
  onStartFreeform: () => void;
}

/** Custom dropdown component (extracted from WorkoutPicker) */
function CustomSelect<T extends string>({
  label,
  value,
  open,
  onToggle,
  onClose,
  children,
  renderSelected,
}: {
  label: string;
  value: T | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  renderSelected: () => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-1 block">
        {label}
      </label>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left text-sm bg-[var(--color-bg)] border border-[var(--color-line)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-lime)] flex items-center justify-between gap-2"
      >
        <div className="flex-1 min-w-0">
          {value ? renderSelected() : (
            <span className="text-[var(--color-muted)]">Select...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--color-muted)] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-line)] rounded shadow-lg max-h-64 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

export function GymStartModal({ sessionId, onWorkoutSelected, onStartFreeform }: GymStartModalProps) {
  const plans = useTemplatesStore((s) => s.plans);
  const planIds = useTemplatesStore((s) => s.planIds);
  const activePlanId = useTemplatesStore((s) => s.activePlanId);

  const [view, setView] = useState<'cards' | 'quick-ai'>('cards');
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);
  const [fetchedRecent, setFetchedRecent] = useState(false);

  // Plan selection state
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(activePlanId);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [dayAutoSelected, setDayAutoSelected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);

  // Fetch recent workouts on mount
  useEffect(() => {
    if (fetchedRecent) return;
    setFetchedRecent(true);
    getRecentWorkouts(undefined, 20)
      .then((data) => { setRecentWorkouts(data); setRecentLoaded(true); })
      .catch(() => { setRecentLoaded(true); });
  }, [fetchedRecent]);

  const hasPlans = planIds.length > 0;
  const selectedPlan = selectedPlanId ? plans[selectedPlanId] : null;

  const trainingDays = useMemo(
    () =>
      selectedPlan?.days
        .filter((d) => !d.isRestDay)
        .sort((a, b) => a.orderIndex - b.orderIndex) ?? [],
    [selectedPlan],
  );

  // Check if all plan days are rest days
  const allRestDays = useMemo(() => {
    if (!hasPlans) return true;
    return planIds.every((pid) => {
      const p = plans[pid];
      return !p || p.days.every((d) => d.isRestDay);
    });
  }, [hasPlans, planIds, plans]);

  const planDisabled = !hasPlans || allRestDays;

  const predictedDay = useMemo(
    () =>
      selectedPlan && recentWorkouts.length >= 0
        ? predictNextPlanDay(selectedPlan, recentWorkouts)
        : undefined,
    [selectedPlan, recentWorkouts],
  );

  useEffect(() => {
    if (predictedDay && !dayAutoSelected && recentLoaded) {
      setSelectedDayId(predictedDay.id);
      setDayAutoSelected(true);
    }
  }, [predictedDay, dayAutoSelected, recentLoaded]);

  const handlePlanChange = useCallback((newPlanId: string) => {
    setSelectedPlanId(newPlanId);
    setSelectedDayId(null);
    setDayAutoSelected(false);
    setPlanOpen(false);
  }, []);

  const handleDayChange = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
    setDayOpen(false);
  }, []);

  const handleStartPlan = useCallback(async () => {
    if (!selectedPlan || !selectedDayId || isLoading) return;
    const selectedDay = selectedPlan.days.find((d) => d.id === selectedDayId);
    if (!selectedDay) return;

    setIsLoading(true);
    try {
      const workoutLog = await resolvePlanDayToWorkoutLog(selectedPlan, selectedDay);
      onWorkoutSelected(workoutLog);
    } catch (err) {
      console.error('[GymStartModal] Error resolving plan day:', err);
      const fallbackDay = selectedPlan.days.find((d) => d.id === selectedDayId);
      if (fallbackDay) {
        const workoutLog = workoutFromPlanDay(selectedPlan, fallbackDay);
        onWorkoutSelected(workoutLog);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlan, selectedDayId, isLoading, onWorkoutSelected]);

  const selectedDay = selectedPlan?.days.find((d) => d.id === selectedDayId);

  if (view === 'quick-ai') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg)] overflow-y-auto">
        <QuickAIPanel
          onWorkoutGenerated={onWorkoutSelected}
          onBack={() => setView('cards')}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-7 pt-8 pb-4">
          <p className="font-serif text-2xl text-[var(--color-text)]">
            What&apos;s the plan?
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Choose how to start your session
          </p>
        </div>

        {/* Option Cards */}
        <div className="flex-1 px-5 sm:px-7 space-y-3 pb-8">

          {/* Card 1 — Continue Plan */}
          <div
            className={`border rounded-lg transition-all ${
              planDisabled
                ? 'border-[var(--color-line)] opacity-50'
                : planExpanded
                  ? 'border-[var(--color-lime)]/40 bg-[var(--color-surface)]'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-lime)]/30'
            }`}
          >
            <button
              onClick={() => !planDisabled && setPlanExpanded(!planExpanded)}
              disabled={planDisabled}
              className="w-full text-left px-4 py-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--color-lime)]/10 flex items-center justify-center flex-shrink-0">
                <ClipboardIcon className="w-5 h-5 text-[var(--color-lime)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">Continue Plan</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  {planDisabled
                    ? 'No plans yet'
                    : predictedDay
                      ? `Next up: ${predictedDay.name}`
                      : 'Pick a day from your program'}
                </p>
              </div>
              {!planDisabled && (
                <ChevronDown className={`w-4 h-4 text-[var(--color-muted)] transition-transform ${planExpanded ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* Expanded: Plan + Day selectors */}
            {planExpanded && !planDisabled && (
              <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-line)]">
                <div className="pt-3" />

                {/* Plan select */}
                <CustomSelect
                  label="Plan"
                  value={selectedPlanId}
                  open={planOpen}
                  onToggle={() => { setPlanOpen(!planOpen); setDayOpen(false); }}
                  onClose={() => setPlanOpen(false)}
                  renderSelected={() => {
                    const p = selectedPlanId ? plans[selectedPlanId] : null;
                    if (!p) return <span className="text-[var(--color-muted)]">Select...</span>;
                    const dayCount = p.days.filter(d => !d.isRestDay).length;
                    return (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{p.name}</span>
                        {selectedPlanId === activePlanId && (
                          <span className="text-[9px] px-1 py-0.5 bg-[var(--color-lime)]/20 text-[var(--color-lime)] font-medium flex-shrink-0">
                            active
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0">{dayCount}d</span>
                      </div>
                    );
                  }}
                >
                  {planIds.map((pid) => {
                    const p = plans[pid];
                    if (!p) return null;
                    const dayCount = p.days.filter(d => !d.isRestDay).length;
                    const totalExercises = p.days.reduce((sum, d) => sum + d.exercises.length, 0);
                    const isActive = pid === activePlanId;
                    const isSelected = pid === selectedPlanId;
                    return (
                      <button
                        key={pid}
                        onClick={() => handlePlanChange(pid)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-[var(--color-bg)] transition-colors border-b border-[var(--color-line)] last:border-b-0 ${isSelected ? 'bg-[var(--color-bg)]' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text)] truncate">{p.name}</span>
                          {isActive && (
                            <span className="text-[9px] px-1 py-0.5 bg-[var(--color-lime)]/20 text-[var(--color-lime)] font-medium flex-shrink-0">
                              active
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-lime)] ml-auto flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[var(--color-muted)]">{dayCount} training days</span>
                          <span className="text-[10px] text-[var(--color-muted)]">&middot;</span>
                          <span className="text-[10px] text-[var(--color-muted)]">{totalExercises} exercises</span>
                        </div>
                      </button>
                    );
                  })}
                </CustomSelect>

                {/* Day select */}
                {selectedPlan && (
                  <div className="space-y-3">
                    <CustomSelect
                      label="Day"
                      value={selectedDayId}
                      open={dayOpen}
                      onToggle={() => { setDayOpen(!dayOpen); setPlanOpen(false); }}
                      onClose={() => setDayOpen(false)}
                      renderSelected={() => {
                        if (!selectedDay) return <span className="text-[var(--color-muted)]">Select...</span>;
                        return (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{selectedDay.name}</span>
                            {selectedDay.id === predictedDay?.id && (
                              <span className="text-[9px] px-1 py-0.5 bg-[var(--color-muted)]/20 text-[var(--color-text)] font-medium flex-shrink-0">
                                next up
                              </span>
                            )}
                            <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0">
                              {selectedDay.exercises.length} ex
                            </span>
                          </div>
                        );
                      }}
                    >
                      {trainingDays.map((day) => {
                        const isSelected = day.id === selectedDayId;
                        const isPredicted = day.id === predictedDay?.id;
                        const lastDone = getLastDoneDate(day, selectedPlan.id, recentWorkouts);
                        return (
                          <button
                            key={day.id}
                            onClick={() => handleDayChange(day.id)}
                            className={`w-full text-left px-3 py-2.5 hover:bg-[var(--color-bg)] transition-colors border-b border-[var(--color-line)] last:border-b-0 ${isSelected ? 'bg-[var(--color-bg)]' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--color-text)] truncate">{day.name}</span>
                              {isPredicted && (
                                <span className="text-[9px] px-1 py-0.5 bg-[var(--color-muted)]/20 text-[var(--color-text)] font-medium flex-shrink-0">
                                  next up
                                </span>
                              )}
                              {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-lime)] ml-auto flex-shrink-0" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {day.targetMuscles.slice(0, 3).map((mg) => (
                                <span
                                  key={mg}
                                  className={`text-[9px] px-1 py-0.5 font-medium ${getMuscleGroupColor(mg)}`}
                                >
                                  {formatMuscleGroup(mg)}
                                </span>
                              ))}
                              <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-0.5">
                                <Dumbbell className="w-2.5 h-2.5" />
                                {day.exercises.length}
                              </span>
                              {day.estimatedDuration > 0 && (
                                <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {day.estimatedDuration}m
                                </span>
                              )}
                              {lastDone && (
                                <span className="text-[10px] text-[var(--color-muted)] ml-auto">
                                  {lastDone}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </CustomSelect>

                    {/* Start button */}
                    <button
                      onClick={handleStartPlan}
                      disabled={!selectedDayId || isLoading}
                      className="w-full py-2.5 bg-[var(--color-lime)] text-[var(--color-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center rounded gap-1.5 text-sm font-medium"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Start Workout</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Disabled hint */}
            {planDisabled && (
              <div className="px-4 pb-3">
                <a
                  href="/templates"
                  className="text-[11px] text-[var(--color-lime)] hover:underline"
                >
                  Create a workout plan &rarr;
                </a>
              </div>
            )}
          </div>

          {/* Card 2 — Freeform Workout */}
          <button
            onClick={onStartFreeform}
            className="w-full text-left border border-[var(--color-line)] rounded-lg bg-[var(--color-surface)] hover:border-[var(--color-muted)]/40 transition-all px-4 py-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-muted)]/10 flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-5 h-5 text-[var(--color-muted)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">Freeform Workout</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Track whatever you want. AI adapts to you.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
          </button>

          {/* Card 3 — Quick AI Workout */}
          <button
            onClick={() => setView('quick-ai')}
            className="w-full text-left border border-[var(--color-lime)]/20 rounded-lg bg-[var(--color-lime)]/5 hover:border-[var(--color-lime)]/40 transition-all px-4 py-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-lime)]/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-[var(--color-lime)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">Quick AI Workout</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Tell me what you want, I&apos;ll build it
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--color-lime)] flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple clipboard/plan icon */
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}
