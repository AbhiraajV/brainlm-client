'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionsStore, useSession } from '@/store/sessions.store';
import { useHydrated } from '@/hooks/useHydrated';
import { SessionEventInput } from '@/components/sessions/SessionEventInput';
import { SessionInfoCard } from '@/components/sessions/SessionInfoCard';
import { EventSuggestion } from '@/components/sessions/EventSuggestion';
import { MasterSummaryCard } from '@/components/sessions/MasterSummaryCard';
import { WorkoutLogCard } from '@/components/sessions/WorkoutLogCard';
import { DietLogCard } from '@/components/sessions/DietLogCard';
import { HabitLogCard } from '@/components/sessions/HabitLogCard';
import { HabitCalendarView } from '@/components/sessions/HabitCalendarView';
import { SuggestedDiet } from '@/components/sessions/SuggestedDiet';
import { PRCelebration } from '@/components/sessions/PRCelebration';
import { generateEventSuggestion } from '@/server/actions/event-suggestion.actions';
import { completeSession } from '@/server/actions/session-complete.actions';
import { fetchRecentDietHistory } from '@/server/actions/diet-history.actions';
import { generateDietDayPlan } from '@/server/actions/diet-daily-plan.actions';
import { computeDietHistorySummary, formatDietHistoryForPrompt, formatDayPlanForPrompt, formatDietProfileForPrompt } from '@/lib/diet/history-utils';
import { BackButton } from '@/components/ui/BackButton';
import { useTodaysEventsFromCache } from '@/hooks/useTodaysEventsFromCache';
import type { EventDraft, Session, TrackerType, WorkoutLog, DietLog, DietDayPlan, DietHistoryDay, HabitLog, PRSummary, DailyTargets } from '@/lib/sessions/types';
import type { LastLoggedSet } from '@/server/agents/gym-coach-agent';
import { DietCoachFirstMessage } from '@/components/sessions/DietCoachFirstMessage';
import { TodaysMealPlanCard } from '@/components/sessions/TodaysMealPlanCard';
import { generateTodaysMealPlan, type SOSContext } from '@/server/actions/diet-meal-plan.actions';
import { Trash2, MessageSquare, Dumbbell, Utensils, CheckSquare, CalendarDays, Brain, Clock, Calendar, Sparkles, BarChart3, ChevronDown, ChevronRight, Loader2, ClipboardList, BookOpen } from 'lucide-react';
import { useHabitsStore } from '@/store/habits.store';
import { useDietGoalsStore } from '@/store/diet-goals.store';
import { createEmptyHabitLog, recalculateSummary } from '@/lib/habit/utils';
import { createEmptyDietLog } from '@/lib/diet/macros';
import { saveHabitSession } from '@/server/actions/habit-session.actions';
import { saveWorkoutSession } from '@/server/actions/workout-session.actions';
import { saveDietSession } from '@/server/actions/diet-session.actions';
import { useTemplatesStore } from '@/store/templates.store';
import { useExercisesStore } from '@/store/exercises.store';
import { useExerciseLibraryStore } from '@/store/exercise-library.store';
import { getKnownExercises } from '@/server/actions/exercise-library.actions';
import { formatPlanForPrompt } from '@/lib/templates/utils';
import { GymStartModal } from '@/components/sessions/GymStartModal';
import { ExerciseResolvePopup } from '@/components/sessions/ExerciseResolvePopup';
import { WorkoutSavePrompt } from '@/components/sessions/WorkoutSavePrompt';
import { SessionAnalysis as SessionAnalysisComponent } from '@/components/sessions/SessionAnalysis';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { TabBar } from '@/components/ui/TabBar';
import type { SessionKnowledge, ExerciseEntry, MuscleGroup, EquipmentType } from '@/lib/sessions/types';

// Track in-flight suggestion requests to prevent duplicates
const inFlightRequests = new Set<string>();

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function EventDraftRow({
  event,
  sessionId,
  onRetry,
  onDelete,
}: {
  event: EventDraft;
  sessionId: string;
  onRetry: (eventId: string) => void;
  onDelete: (eventId: string) => void;
}) {
  return (
    <article className="px-5 sm:px-7 py-3 bg-[var(--color-surface)]">
      <div className="flex items-start gap-3">
        {/* Event dot */}
        <div className="w-2 h-2 rounded-full bg-[var(--color-line)] flex-shrink-0 mt-1.5" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row with timestamp and delete */}
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-[10px] text-[var(--color-muted)]">{formatTimeAgo(event.createdAt)}</span>
            <button
              onClick={() => onDelete(event.id)}
              className="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors opacity-60 hover:opacity-100"
              aria-label="Delete event"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Message content */}
          <p className="text-sm text-[var(--color-text)] leading-relaxed">{event.content}</p>

          {/* LLM Suggestion */}
          <EventSuggestion
            sessionId={sessionId}
            eventId={event.id}
            status={event.llmCommentStatus}
            comment={event.llmComment}
            error={event.llmCommentError}
            onRetry={() => onRetry(event.id)}
          />
        </div>
      </div>
    </article>
  );
}

// Helper to get domain knowledge from analysis or understanding
// Prefer analysis.context (new) over understanding.content (legacy)
function getDomainKnowledge(analysisContext?: string, understandingContent?: string): string {
  return analysisContext || understandingContent || '';
}

// Collapsible section for insights tab
function InsightsSection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = false
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 py-3 px-5 sm:px-7 text-left hover:bg-[var(--color-bg)] transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)]" />
        )}
        <Icon className="w-4 h-4 text-[var(--color-muted)]" />
        <span className="text-sm font-medium text-[var(--color-text)]">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-xs text-[var(--color-muted)]">({count})</span>
        )}
      </button>
      {isOpen && (
        <div className="px-5 sm:px-7 pb-4 pl-12 sm:pl-14">
          {children}
        </div>
      )}
    </div>
  );
}

// Knowledge content renderer
function KnowledgeContent({ knowledge }: { knowledge: SessionKnowledge }) {
  return (
    <div className="space-y-3">
      {knowledge.events.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Related Events</h4>
          <div className="space-y-2">
            {knowledge.events.map((event, i) => (
              <div key={event.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <p className="line-clamp-2">{event.content}</p>
                <p className="text-[10px] text-[var(--color-muted)] mt-1">
                  {new Date(event.occurredAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.interpretations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Interpretations</h4>
          <div className="space-y-2">
            {knowledge.interpretations.map((interp, i) => (
              <div key={interp.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <MarkdownRenderer content={interp.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.patterns.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Patterns</h4>
          <div className="space-y-2">
            {knowledge.patterns.map((pattern, i) => (
              <div key={pattern.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <p className="font-medium mb-1">{pattern.name}</p>
                <MarkdownRenderer content={pattern.description} />
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.insights.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Insights</h4>
          <div className="space-y-2">
            {knowledge.insights.map((insight, i) => (
              <div key={insight.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <MarkdownRenderer content={insight.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.reviews.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Reviews</h4>
          <div className="space-y-2">
            {knowledge.reviews.map((review, i) => (
              <div key={review.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-surface)] rounded">
                    {review.type}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">{review.periodKey}</span>
                </div>
                <MarkdownRenderer content={review.summary} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Thin SSR-safe shell — no Zustand hooks here, prevents getServerSnapshot errors.
// All store-dependent logic lives in SessionDetailInner which only mounts client-side.
export default function SessionDetailPage() {
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

  return <SessionDetailInner />;
}

function SessionDetailInner() {
  const params = useParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const sessionId = params.id as string;

  const session = useSession(sessionId);
  const setEventLlmComment = useSessionsStore((s) => s.setEventLlmComment);
  const markSessionCompleted = useSessionsStore((s) => s.markSessionCompleted);
  const setTrackerType = useSessionsStore((s) => s.setTrackerType);
  const deleteEventDraft = useSessionsStore((s) => s.deleteEventDraft);
  const setWorkoutLog = useSessionsStore((s) => s.setWorkoutLog);
  const setDietLog = useSessionsStore((s) => s.setDietLog);
  const setDietDayPlan = useSessionsStore((s) => s.setDietDayPlan);
  const setTodaysMealPlan = useSessionsStore((s) => s.setTodaysMealPlan);
  const setHabitLog = useSessionsStore((s) => s.setHabitLog);
  const [isCompleting, setIsCompleting] = useState(false);
  const [prsDetected, setPrsDetected] = useState<PRSummary[]>([]);
  const [lastLoggedSet, setLastLoggedSet] = useState<LastLoggedSet | null>(null);
  const [activeTab, setActiveTab] = useState<'coach' | 'workout' | 'insights' | 'habit' | 'history'>('coach');
  const [dietHistoryContext, setDietHistoryContext] = useState<string | null>(null);
  const [dayPlanContext, setDayPlanContext] = useState<string | null>(null);
  const [dietWeekHistory, setDietWeekHistory] = useState<DietHistoryDay[]>([]);
  const [pendingRecommendation, setPendingRecommendation] = useState<DietDayPlan | null>(null);
  const [mealPlanGenerating, setMealPlanGenerating] = useState(false);
  const [unresolvedExercise, setUnresolvedExercise] = useState<ExerciseEntry | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [gymWorkoutContext, setGymWorkoutContext] = useState<{ workoutName: string; muscleGroups: MuscleGroup[]; exerciseNames: string[] } | null>(null);
  const [workoutModeChosen, setWorkoutModeChosen] = useState(false);

  // Today's events from local cache - always current
  const todaysEventsFromCache = useTodaysEventsFromCache();

  // Compute workout plan context for plan-aware coaching
  // Falls back to active plan if workout doesn't have a templateId
  const planContextForCoach = (() => {
    if (session?.trackerType !== 'gym') return undefined;
    const store = useTemplatesStore.getState();
    const templateId = session?.workoutLog?.templateId || store.activePlanId;
    if (!templateId) return undefined;
    const plan = store.plans[templateId];
    return plan ? formatPlanForPrompt(plan) : undefined;
  })();

  // Generate LLM suggestion for an event
  const generateSuggestion = useCallback(async (eventId: string, session: Session) => {
    // Prevent duplicate requests for the same event
    const requestKey = `${session.id}:${eventId}`;
    if (inFlightRequests.has(requestKey)) {
      console.log('[generateSuggestion] Skipping duplicate request for:', requestKey);
      return;
    }

    const event = session.events.find(e => e.id === eventId);
    if (!event) return;

    // Mark this request as in-flight
    inFlightRequests.add(requestKey);
    console.log('[generateSuggestion] Starting request:', requestKey);

    // Mark as generating
    setEventLlmComment(session.id, eventId, null, 'generating');

    // Get domain knowledge from analysis (preferred) or understanding (legacy)
    const domainKnowledge = getDomainKnowledge(session.analysis?.context, session.understanding?.content);
    // Get guide name from analysis sessionType or understanding
    const guideMap: Record<string, string> = { gym: 'Gym Coach', diet: 'Nutrition Coach', addiction: 'Recovery Coach', general: 'Coach' };
    const guide = session.analysis?.sessionType
      ? guideMap[session.analysis.sessionType]
      : (session.understanding?.guide || 'Coach');
    const goal = session.sessionContext || session.analysis?.userGoals || session.understanding?.inferredGoal || '';

    // Infer tracker type from analysis, session type, or event content
    let trackerType: TrackerType = session.analysis?.sessionType || session.trackerType || 'general';

    // If still general, try to infer from event content
    if (trackerType === 'general') {
      const eventText = event.content.toLowerCase();
      // Diet patterns
      if (/food|calories|eating|macros|protein|meal|nutrition|diet|breakfast|lunch|dinner|snack|carbs|fat|ate|drink|coffee|shake|egg|chicken|rice|salad|fruit|vegetable|cal\b|kcal/.test(eventText)) {
        trackerType = 'diet';
        // Persist the inferred tracker type for subsequent events
        setTrackerType(session.id, 'diet');
      }
      // Gym patterns
      else if (/workout|gym|exercise|lift|training|chest|back|legs|arms|shoulders|push|pull|bench|squat|deadlift|weight|reps|sets|curl|press|row/.test(eventText)) {
        trackerType = 'gym';
        // Persist the inferred tracker type for subsequent events
        setTrackerType(session.id, 'gym');
      }
    }

    // Debug logging
    console.log('[generateSuggestion] trackerType:', trackerType);
    console.log('[generateSuggestion] session.analysis?.sessionType:', session.analysis?.sessionType);
    console.log('[generateSuggestion] session.trackerType:', session.trackerType);
    console.log('[generateSuggestion] event.content:', event.content);

    // Get previous events (all events before this one chronologically)
    const eventIndex = session.events.findIndex(e => e.id === eventId);
    const previousEvents = session.events
      .slice(0, eventIndex)
      .map(e => ({ content: e.content, createdAt: e.createdAt, llmComment: e.llmComment }));

    // Use today's events from local cache (always current, no API calls needed)
    const todaysEvents = todaysEventsFromCache.map(e => ({
      content: e.content,
      occurredAt: e.occurredAt,
    }));
    const yesterdaysReview = session.knowledge?.yesterdaysReview
      ? { summary: session.knowledge.yesterdaysReview.summary, periodKey: session.knowledge.yesterdaysReview.periodKey }
      : undefined;

    // Get today's plan from knowledge
    const todaysPlan = session.knowledge?.todaysPlan
      ? { renderedMarkdown: session.knowledge.todaysPlan.renderedMarkdown }
      : undefined;

    // Get menstrual cycle phase from knowledge (if tracking)
    const cyclePhase = session.knowledge?.cyclePhase;

    console.log('[generateSuggestion] === CALLING SERVER ACTION ===');
    try {
      console.log('[generateSuggestion] About to await generateEventSuggestion...');
      const result = await generateEventSuggestion(
        session.id,
        eventId,
        event.content,
        previousEvents,
        session.title,
        goal,
        guide,
        domainKnowledge,
        trackerType,
        session.masterSummary,
        todaysEvents,
        yesterdaysReview,
        todaysPlan,
        cyclePhase,
        session.analysis,  // Pass the detailed analysis for enhanced coaching
        session.workoutLog,  // Pass current workout log for gym tracker
        session.dietLog,     // Pass current diet log for diet tracker
        lastLoggedSet ?? undefined,  // Pass last logged set for "another set" context
        undefined,  // lastLoggedFood
        planContextForCoach,  // Pass workout plan context for plan-aware coaching
        dietHistoryContext ?? undefined,  // Diet history context for diet coach
        dayPlanContext ?? undefined  // Day plan context for diet coach
      );

      // Debug: log raw result from server action
      console.log('[generateSuggestion] *** SERVER ACTION COMPLETED ***');
      console.log('[generateSuggestion] Raw result from server:', JSON.stringify(result).substring(0, 1000));
      console.log('[generateSuggestion] Result keys:', Object.keys(result));

      if ('comment' in result) {
        console.log('[generateSuggestion] Has workoutLogJson?', !!result.workoutLogJson);
        console.log('[generateSuggestion] Has dietLogJson?', !!result.dietLogJson);

        // Parse JSON strings back into objects (workaround for Next.js serialization)
        let workoutLog: WorkoutLog | undefined = result.workoutLog;
        let dietLog: DietLog | undefined = result.dietLog;

        if (result.workoutLogJson) {
          try {
            workoutLog = JSON.parse(result.workoutLogJson);
            console.log('[generateSuggestion] Parsed workoutLogJson successfully');
          } catch (e) {
            console.error('[generateSuggestion] Failed to parse workoutLogJson:', e);
          }
        }

        if (result.dietLogJson) {
          try {
            dietLog = JSON.parse(result.dietLogJson);
            console.log('[generateSuggestion] Parsed dietLogJson successfully');
          } catch (e) {
            console.error('[generateSuggestion] Failed to parse dietLogJson:', e);
          }
        }

        // Debug logging
        console.log('[generateSuggestion] Result received:', {
          hasComment: !!result.comment,
          hasMasterSummary: !!result.masterSummary,
          hasWorkoutLogJson: !!result.workoutLogJson,
          hasDietLogJson: !!result.dietLogJson,
          parsedWorkoutLog: !!workoutLog,
          parsedDietLog: !!dietLog,
          prsDetected: result.prsDetected?.length ?? 0,
        });

        // Resolve exercise registry IDs for any new exercises in workoutLog
        if (workoutLog?.exercises) {
          const registry = useExercisesStore.getState();
          for (const ex of workoutLog.exercises) {
            if (!ex.exerciseRegistryId) {
              const def = registry.resolveExercise(ex.exerciseName, ex.muscleGroup, ex.equipmentType);
              ex.exerciseRegistryId = def.id;
            }
          }

          // Check for unresolved exercises (agent skipped search)
          const firstUnresolved = workoutLog.exercises.find(e => e.needsResolution);
          if (firstUnresolved) {
            setUnresolvedExercise(firstUnresolved);
          }
        }

        // Pass structured logs to update (for diet/gym trackers)
        setEventLlmComment(
          session.id,
          eventId,
          result.comment,
          'completed',
          undefined,
          result.masterSummary,  // Legacy
          workoutLog,            // Structured workout data
          dietLog                // Structured diet data
        );

        // Show PR celebration if PRs were detected
        if (result.prsDetected && result.prsDetected.length > 0) {
          console.log('[generateSuggestion] PRs detected:', result.prsDetected);
          setPrsDetected(result.prsDetected);
        }

        // Store last logged set for "another set" context continuity
        if (result.lastLoggedSet) {
          console.log('[generateSuggestion] Storing lastLoggedSet:', result.lastLoggedSet);
          setLastLoggedSet(result.lastLoggedSet);
        }
      } else {
        console.log('[generateSuggestion] Error result:', result.error);
        setEventLlmComment(session.id, eventId, null, 'failed', result.error);
      }
    } catch (err) {
      console.error('[generateSuggestion] Exception caught:', err);
      setEventLlmComment(session.id, eventId, null, 'failed', 'Network error');
    } finally {
      // Always remove from in-flight when done
      inFlightRequests.delete(requestKey);
      console.log('[generateSuggestion] Request completed, removed from in-flight:', requestKey);
    }
  }, [setEventLlmComment, setTrackerType, todaysEventsFromCache, lastLoggedSet, dietHistoryContext, dayPlanContext]);

  // Handle retry for failed suggestions
  const handleRetry = useCallback((eventId: string) => {
    if (!session) return;
    generateSuggestion(eventId, session);
  }, [session, generateSuggestion]);

  // Handle delete event
  const handleDelete = useCallback((eventId: string) => {
    if (!session) return;
    deleteEventDraft(session.id, eventId);
  }, [session, deleteEventDraft]);

  // Handle session completion
  const handleCompleteSession = async () => {
    if (!session || isCompleting) return;

    // Get guide from analysis or understanding
    const guideMap: Record<string, string> = { gym: 'Gym Coach', diet: 'Nutrition Coach', addiction: 'Recovery Coach', general: 'Coach' };
    const guide = session.analysis?.sessionType
      ? guideMap[session.analysis.sessionType]
      : session.understanding?.guide;

    setIsCompleting(true);
    try {
      const result = await completeSession({
        sessionTitle: session.title,
        sessionGoal: session.sessionContext || session.analysis?.userGoals || session.understanding?.inferredGoal || '',
        guide,
        events: session.events.map(e => ({
          content: e.content,
          createdAt: e.createdAt,
          llmComment: e.llmComment,
        })),
        coachBrief: session.analysis?.context || session.understanding?.content,
        // Include session analysis and suggestions
        analysis: session.analysis ? {
          sessionType: session.analysis.sessionType,
          relevantHistory: session.analysis.relevantHistory.map(h => ({
            date: h.date,
            event: h.event,
            highlight: h.highlight,
          })),
          patterns: session.analysis.patterns.map(p => ({
            name: p.name,
            description: p.description,
            trend: p.trend,
          })),
          correlations: session.analysis.correlations.map(c => ({
            factor: c.factor,
            impact: c.impact,
            direction: c.direction,
          })),
          context: session.analysis.context,
          userGoals: session.analysis.userGoals,
        } : undefined,
        masterSummary: session.masterSummary,
        suggestedWorkout: session.suggestedWorkout ? {
          exercises: session.suggestedWorkout.exercises,
          reason: session.suggestedWorkout.reason,
        } : undefined,
        suggestedDiet: session.suggestedDiet ? {
          meals: session.suggestedDiet.meals,
          dailyTotals: session.suggestedDiet.dailyTotals,
          reason: session.suggestedDiet.reason,
        } : undefined,
      });

      if (result.success) {
        markSessionCompleted(session.id);
        router.push('/sessions');
      } else {
        console.error(result.error);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  // Auto-initialize habit log + set default tab for habit sessions
  const habitInitRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !session) return;
    if (session.trackerType !== 'habit') return;

    // Set default tab once per mount
    if (!habitInitRef.current) {
      habitInitRef.current = true;
      setActiveTab('habit');
    }

    // Initialize habit log if needed
    if (session.habitLog) return;

    // Read habits imperatively to avoid subscribing at top-level render
    const habits = useHabitsStore.getState().habits;
    const active = habits.filter((h) => !h.isArchived).sort((a, b) => a.orderIndex - b.orderIndex);
    if (active.length === 0) return;

    const emptyLog = createEmptyHabitLog(active);
    setHabitLog(session.id, emptyLog);
  }, [hydrated, session?.id, session?.trackerType, session?.habitLog, setHabitLog]);

  // Auto-initialize diet log with targets from diet goals profile
  // If no profile exists, redirect to diet goals setup
  useEffect(() => {
    if (!hydrated || !session) return;
    if (session.trackerType !== 'diet') return;
    if (session.dietLog) return; // already initialized

    const profile = useDietGoalsStore.getState().profile;
    if (!profile?.targets) {
      router.push('/diet-goals');
      return;
    }
    const dietLog = createEmptyDietLog(profile.targets);
    setDietLog(session.id, dietLog);
  }, [hydrated, session?.id, session?.trackerType, session?.dietLog, setDietLog, router]);

  // Fetch diet history + generate recommendation for diet sessions
  const dietPlanInitRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !session) return;
    if (session.trackerType !== 'diet') return;
    if (dietPlanInitRef.current) return;

    const profile = useDietGoalsStore.getState().profile;
    if (!profile) return;

    if (session.dietDayPlan) {
      // Already accepted/confirmed — just build context strings
      setDayPlanContext(formatDayPlanForPrompt(session.dietDayPlan, profile.targets));
      setDietHistoryContext(formatDietProfileForPrompt(profile));
      dietPlanInitRef.current = true;
      return;
    }

    dietPlanInitRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        // 1. Fetch history (with notes)
        const history = await fetchRecentDietHistory(14);
        if (cancelled) return;

        // 2. Store this week for the first-message component
        setDietWeekHistory(history.slice(0, 7));

        // 3. Build coach context from history
        const summary = computeDietHistorySummary(history, profile.targets);
        const histCtx = formatDietHistoryForPrompt(summary, profile.targets);
        const profileCtx = formatDietProfileForPrompt(profile);
        setDietHistoryContext(`${histCtx}\n\n${profileCtx}`);

        // 4. Generate recommendation (don't auto-accept — user decides)
        const plan = await generateDietDayPlan(profile, history.slice(0, 7));
        if (cancelled) return;

        setPendingRecommendation(plan);
      } catch (err) {
        console.error('[DietPlanInit] Error:', err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.id, session?.trackerType]);

  // Handle today's meal plan generation
  const handleGenerateMealPlan = useCallback(async (preferences?: string) => {
    if (!session || mealPlanGenerating) return;

    setMealPlanGenerating(true);
    try {
      const profile = useDietGoalsStore.getState().profile;
      const targets = session.dietDayPlan?.targets ?? session.dietLog?.targets ?? profile?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 };

      // Build SOS context if food has been logged
      let sosContext: SOSContext | undefined;
      if (session.dietLog && session.dietLog.meals.length > 0) {
        const { summary, meals } = session.dietLog;
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
        setTodaysMealPlan(session.id, result.meals, result.analysis);
      }
    } catch (err) {
      console.error('[handleGenerateMealPlan] Error:', err);
    } finally {
      setMealPlanGenerating(false);
    }
  }, [session, mealPlanGenerating, setTodaysMealPlan]);

  // Handle habit session completion
  const handleCompleteHabitSession = async () => {
    if (!session?.habitLog || isCompleting) return;

    setIsCompleting(true);
    try {
      await saveHabitSession(session.habitLog);
      markSessionCompleted(session.id);
      router.push('/sessions');
    } catch (err) {
      console.error('[handleCompleteHabitSession] Error:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle gym session completion - saves workoutLog with rawJson + trackedType + WorkerJob
  const handleCompleteGymSession = async () => {
    if (!session?.workoutLog || isCompleting) return;

    const workout = session.workoutLog;

    // Mode A: Plan-day session — always show save prompt (auto-dismisses if no diff)
    if (workout.templateId && workout.templateDayId) {
      setShowSavePrompt(true);
      return;
    }

    // Mode B: Freeform session — always offer save for workouts with ≥3 exercises
    // WorkoutSavePrompt handles Jaccard matching internally
    if (workout.exercises.length >= 3) {
      setShowSavePrompt(true);
      return;
    }

    await doSaveGymSession();
  };

  const doSaveGymSession = async () => {
    if (!session?.workoutLog) return;

    setIsCompleting(true);
    try {
      await saveWorkoutSession(
        session.workoutLog,
        session.events.map(e => ({ content: e.content, llmComment: e.llmComment ?? undefined })),
        {
          title: session.title,
          goal: session.sessionContext || session.analysis?.userGoals || '',
          guide: 'Gym Coach',
          analysis: session.analysis ? {
            sessionType: session.analysis.sessionType,
            relevantHistory: session.analysis.relevantHistory?.map(h => ({
              date: h.date, event: h.event, highlight: h.highlight,
            })),
            patterns: session.analysis.patterns?.map(p => ({
              name: p.name, description: p.description, trend: p.trend,
            })),
            correlations: session.analysis.correlations?.map(c => ({
              factor: c.factor, impact: c.impact, direction: c.direction,
            })),
            context: session.analysis.context,
            userGoals: session.analysis.userGoals,
          } : undefined,
        },
      );
      // Invalidate exercise library cache so next visit fetches fresh data
      useExerciseLibraryStore.getState().clearLibrary();
      markSessionCompleted(session.id);
      router.push('/sessions');
    } catch (err) {
      console.error('[handleCompleteGymSession] Error:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle diet session completion - saves dietLog with rawJson + trackedType + WorkerJob
  const handleCompleteDietSession = async () => {
    if (!session?.dietLog || isCompleting) return;

    setIsCompleting(true);
    try {
      await saveDietSession(
        session.dietLog,
        session.events.map(e => ({ content: e.content, llmComment: e.llmComment ?? undefined })),
        {
          title: session.title,
          goal: session.sessionContext || session.analysis?.userGoals || '',
          guide: 'Nutrition Coach',
          analysis: session.analysis ? {
            sessionType: session.analysis.sessionType,
            relevantHistory: session.analysis.relevantHistory?.map(h => ({
              date: h.date, event: h.event, highlight: h.highlight,
            })),
            patterns: session.analysis.patterns?.map(p => ({
              name: p.name, description: p.description, trend: p.trend,
            })),
            correlations: session.analysis.correlations?.map(c => ({
              factor: c.factor, impact: c.impact, direction: c.direction,
            })),
            context: session.analysis.context,
            userGoals: session.analysis.userGoals,
          } : undefined,
        },
      );
      markSessionCompleted(session.id);
      router.push('/sessions');
    } catch (err) {
      console.error('[handleCompleteDietSession] Error:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  // Redirect if session doesn't exist (after hydration)
  useEffect(() => {
    if (hydrated && !session) {
      router.replace('/sessions');
    }
  }, [hydrated, session, router]);

  // Seed client exercise registry from server (ensures global IDs are available)
  const exerciseSeedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !session || session.trackerType !== 'gym') return;
    if (exerciseSeedRef.current) return;
    exerciseSeedRef.current = true;

    getKnownExercises().then((known) => {
      useExercisesStore.getState().seedFromServer(known);
    }).catch(() => {});
  }, [hydrated, session?.trackerType]);

  // Process pending/generating events on page load (handle return to page)
  // Serialized: process one at a time to avoid flooding the server with N parallel requests.
  useEffect(() => {
    if (!hydrated || !session) return;

    // Find events that need LLM comments (pending or were generating when page was left)
    const pendingEvents = session.events.filter(
      e => e.llmCommentStatus === 'pending' || e.llmCommentStatus === 'generating'
    );

    if (pendingEvents.length === 0) return;

    // Process chronologically (oldest first)
    const sortedPending = [...pendingEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let cancelled = false;
    (async () => {
      for (const event of sortedPending) {
        if (cancelled) break;
        await generateSuggestion(event.id, session);
      }
    })();

    return () => { cancelled = true; };
    // Only run once per session load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.id]);

  // Show loading state while hydrating
  if (!hydrated) {
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

  // Return null if redirecting
  if (!session) {
    return null;
  }

  return (
    <>
      {/* PR Celebration Banner */}
      {prsDetected.length > 0 && (
        <PRCelebration
          prs={prsDetected}
          onDismiss={() => setPrsDetected([])}
        />
      )}

      {/* Exercise Resolution Popup */}
      {unresolvedExercise && session?.workoutLog && (
        <ExerciseResolvePopup
          exercise={unresolvedExercise}
          onResolve={(ex, globalId, name, mg, eq) => {
            const updatedExercises = session.workoutLog!.exercises.map(e =>
              e.id === ex.id
                ? { ...e, exerciseName: name, globalExerciseId: globalId, muscleGroup: mg, equipmentType: eq, needsResolution: undefined }
                : e
            );
            const updatedWorkout = { ...session.workoutLog!, exercises: updatedExercises, updatedAt: new Date().toISOString() };
            setWorkoutLog(session.id, updatedWorkout);
            // Check for next unresolved
            const next = updatedExercises.find(e => e.needsResolution);
            setUnresolvedExercise(next ?? null);
          }}
          onCreateCustom={(ex) => {
            const updatedExercises = session.workoutLog!.exercises.map(e =>
              e.id === ex.id ? { ...e, needsResolution: undefined } : e
            );
            const updatedWorkout = { ...session.workoutLog!, exercises: updatedExercises, updatedAt: new Date().toISOString() };
            setWorkoutLog(session.id, updatedWorkout);
            const next = updatedExercises.find(e => e.needsResolution);
            setUnresolvedExercise(next ?? null);
          }}
          onDismiss={() => setUnresolvedExercise(null)}
        />
      )}

      {/* Workout Save Prompt (template matching on completion) */}
      {showSavePrompt && session?.workoutLog && (
        <WorkoutSavePrompt
          workoutLog={session.workoutLog}
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
        {/* Main content */}
        <main className={`flex-1 container-padding overflow-x-hidden ${session.trackerType === 'habit' ? 'pb-8' : 'pb-48'}`}>
          {/* Session Info Card - combines title, goal, coach, knowledge, context */}
          <SessionInfoCard
            sessionId={session.id}
            title={session.title}
            context={session.sessionContext}
            knowledge={session.knowledge}
            understanding={session.understanding}
            analysis={session.analysis}
            trackerType={session.trackerType}
            isCompleted={session.isCompleted}
            hasEvents={
              session.trackerType === 'habit' ? !!session.habitLog?.entries?.length :
                session.trackerType === 'gym' ? !!session.workoutLog?.exercises?.length :
                  session.trackerType === 'diet' ? !!session.dietLog?.meals?.length :
                    session.events.length > 0
            }
            onComplete={
              session.trackerType === 'habit' ? handleCompleteHabitSession :
                session.trackerType === 'gym' ? handleCompleteGymSession :
                  session.trackerType === 'diet' ? handleCompleteDietSession :
                    handleCompleteSession  // fallback for addiction/general
            }
            isCompleting={isCompleting}
            gymWorkoutContext={
              session.trackerType === 'gym'
                ? (gymWorkoutContext ?? (session.workoutLog ? {
                    workoutName: session.workoutLog.workoutName || 'Freeform',
                    muscleGroups: session.workoutLog.muscleGroups,
                    exerciseNames: session.workoutLog.exercises.map(e => e.exerciseName),
                  } : null))
                : undefined
            }
          />

          {/* Habit Tracker: Two tabs (Tracker + History), no EventInput */}
          {session.trackerType === 'habit' ? (
            <>
              {/* Tab buttons */}
              <div className="-mx-5 sm:-mx-7 bg-[var(--color-surface)] sticky top-0 z-10">
                <TabBar
                  tabs={[
                    {
                      id: 'habit',
                      icon: <CheckSquare className="w-4 h-4" />,
                      badge: session.habitLog?.entries?.length
                        ? `${session.habitLog.summary.completedHabits}/${session.habitLog.summary.totalHabits}`
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

              {/* Tab content - full width */}
              <div className="-mx-5 sm:-mx-7 overflow-hidden">
                {/* Tracker Tab */}
                <div className={activeTab === 'habit' ? 'block' : 'hidden'}>
                  <HabitLogCard
                    habitLog={session.habitLog}
                    editable={!session.isCompleted}
                    onUpdate={(updatedHabitLog) => setHabitLog(session.id, updatedHabitLog)}
                    onComplete={handleCompleteHabitSession}
                  />
                </div>

                {/* History Tab */}
                <div className={activeTab === 'history' ? 'block' : 'hidden'}>
                  <HabitCalendarView />
                </div>
              </div>
            </>
          ) : /* Diet Tracker: Tabbed interface for Coach/Diet/Insights */
            (session.analysis?.sessionType === 'diet' || session.trackerType === 'diet') ? (
              <>
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
                      {
                        id: 'coach',
                        icon: <MessageSquare className="w-4 h-4" />,
                        badge: session.events.length > 0 ? session.events.length : undefined,
                      },
                      {
                        id: 'workout',
                        icon: <Utensils className="w-4 h-4" />,
                        badge: session.dietLog?.meals?.length || undefined,
                      },
                      {
                        id: 'insights',
                        icon: <Brain className="w-4 h-4" />,
                      },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as typeof activeTab)}
                  />
                </div>

                {/* Tab content - full width */}
                <div className="-mx-5 sm:-mx-7 overflow-hidden">
                  {/* Coach Tab */}
                  <div className={activeTab === 'coach' ? 'block' : 'hidden'}>
                    {session.events.length > 0 ? (
                      <div className="divide-y divide-[var(--color-line)]">
                        {session.events.map((event) => (
                          <EventDraftRow
                            key={event.id}
                            event={event}
                            sessionId={session.id}
                            onRetry={handleRetry}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 px-5">
                        <MessageSquare className="w-12 h-12 text-[var(--color-line)] mb-4" />
                        <p className="font-serif text-lg text-[var(--color-text)]">No coach comments yet</p>
                        <p className="text-sm text-[var(--color-muted)] mt-1">
                          Log your first meal below
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Diet Tab */}
                  <div className={activeTab === 'workout' ? 'block' : 'hidden'}>
                    <DietCoachFirstMessage
                      recommendation={pendingRecommendation}
                      weekHistory={dietWeekHistory}
                      profileTargets={useDietGoalsStore.getState().profile?.targets ?? session.dietLog?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 }}
                      alreadyAccepted={!!session.dietDayPlan}
                      onAccept={(targets: DailyTargets) => {
                        // Save plan to session store
                        const plan = pendingRecommendation ?? {
                          targets,
                          fiberTarget: targets.fiber ?? 25,
                          reasoning: '',
                          adjustments: [],
                          generatedAt: new Date().toISOString(),
                        };
                        setDietDayPlan(session.id, { ...plan, targets });
                        // Update diet log targets
                        if (session.dietLog) {
                          setDietLog(session.id, {
                            ...session.dietLog,
                            targets: { ...targets },
                            summary: { ...session.dietLog.summary, targets: { ...targets } },
                            updatedAt: new Date().toISOString(),
                          });
                        }
                        // Set coach context
                        const profile = useDietGoalsStore.getState().profile;
                        if (profile) {
                          setDayPlanContext(formatDayPlanForPrompt({ ...plan, targets }, profile.targets));
                        }
                      }}
                      onCustomTargets={(targets: DailyTargets) => {
                        // Save custom plan to session store
                        const customPlan: DietDayPlan = {
                          targets,
                          fiberTarget: targets.fiber ?? 25,
                          reasoning: 'Custom targets set by user.',
                          adjustments: [],
                          generatedAt: new Date().toISOString(),
                        };
                        setDietDayPlan(session.id, customPlan);
                        // Update diet log targets
                        if (session.dietLog) {
                          setDietLog(session.id, {
                            ...session.dietLog,
                            targets: { ...targets },
                            summary: { ...session.dietLog.summary, targets: { ...targets } },
                            updatedAt: new Date().toISOString(),
                          });
                        }
                        // Set coach context
                        const profile = useDietGoalsStore.getState().profile;
                        if (profile) {
                          setDayPlanContext(formatDayPlanForPrompt(customPlan, profile.targets));
                        }
                      }}
                    />
                    <TodaysMealPlanCard
                      meals={session.todaysMealPlan}
                      analysis={session.todaysMealPlanAnalysis}
                      isGenerating={mealPlanGenerating}
                      targetsAccepted={!!session.dietDayPlan}
                      onGenerate={handleGenerateMealPlan}
                      dietLog={session.dietLog}
                    />
                    <DietLogCard
                      dietLog={session.dietLog}
                      editable={true}
                      onUpdate={(updatedDiet) => setDietLog(session.id, updatedDiet)}
                    />
                  </div>

                  {/* Insights Tab */}
                  <div className={activeTab === 'insights' ? 'block' : 'hidden'}>
                    <div className="bg-[var(--color-surface)]">
                      {/* Suggested Diet */}
                      {session.suggestedDiet && (
                        <div className="px-5 sm:px-7 py-4 border-b border-[var(--color-line)]">
                          <SuggestedDiet suggestedDiet={session.suggestedDiet} />
                        </div>
                      )}

                      {/* Analysis Section */}
                      {session.analysis && (
                        <InsightsSection title="Session Analysis" icon={BarChart3} defaultOpen={true}>
                          <SessionAnalysisComponent analysis={session.analysis} />
                        </InsightsSection>
                      )}

                      {/* Yesterday's Review */}
                      {session.knowledge?.yesterdaysReview && (
                        <InsightsSection title={`Yesterday (${session.knowledge.yesterdaysReview.periodKey})`} icon={Calendar} defaultOpen={true}>
                          <div className="text-sm">
                            <MarkdownRenderer content={session.knowledge.yesterdaysReview.summary} />
                          </div>
                        </InsightsSection>
                      )}

                      {/* Raw Knowledge */}
                      {session.knowledge && (
                        <InsightsSection
                          title="Knowledge Base"
                          icon={Sparkles}
                          count={
                            session.knowledge.events.length +
                            session.knowledge.interpretations.length +
                            session.knowledge.patterns.length +
                            session.knowledge.insights.length +
                            session.knowledge.reviews.length
                          }
                        >
                          <KnowledgeContent knowledge={session.knowledge} />
                        </InsightsSection>
                      )}

                      {/* Empty state */}
                      {!session.analysis && !session.knowledge && (
                        <div className="flex flex-col items-center justify-center py-16 px-5">
                          <Brain className="w-12 h-12 text-[var(--color-line)] mb-4" />
                          <p className="font-serif text-lg text-[var(--color-text)]">Building insights...</p>
                          <p className="text-sm text-[var(--color-muted)] mt-1">
                            Analysis will appear as you log meals
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (session.analysis?.sessionType === 'gym' || session.trackerType === 'gym') ? (
              <>
                {/* Full-screen gym start modal — blocks until user picks a path */}
                {!session.workoutLog && session.events.length === 0 && !workoutModeChosen && (
                  <GymStartModal
                    sessionId={session.id}
                    onWorkoutSelected={(log) => {
                      setWorkoutLog(session.id, log);
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
                      {
                        id: 'coach',
                        icon: <MessageSquare className="w-4 h-4" />,
                        badge: session.events.length > 0 ? session.events.length : undefined,
                      },
                      {
                        id: 'workout',
                        icon: <Dumbbell className="w-4 h-4" />,
                        badge: session.workoutLog?.exercises?.length || undefined,
                      },
                      {
                        id: 'insights',
                        icon: <Brain className="w-4 h-4" />,
                      },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as typeof activeTab)}
                  />
                </div>

                {/* Tab content - full width */}
                <div className="-mx-5 sm:-mx-7 overflow-hidden">
                  {/* Coach Tab */}
                  <div
                    className={`
                    ${activeTab === 'coach' ? 'block' : 'hidden'}
                  `}
                  >
                    {session.events.length > 0 ? (
                      <div className="divide-y divide-[var(--color-line)]">
                        {session.events.map((event) => (
                          <EventDraftRow
                            key={event.id}
                            event={event}
                            sessionId={session.id}
                            onRetry={handleRetry}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 px-5">
                        <MessageSquare className="w-12 h-12 text-[var(--color-line)] mb-4" />
                        <p className="font-serif text-lg text-[var(--color-text)]">No coach comments yet</p>
                        <p className="text-sm text-[var(--color-muted)] mt-1">
                          Log your first exercise below
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Workout Tab */}
                  <div className={activeTab === 'workout' ? 'block' : 'hidden'}>
                    <WorkoutLogCard
                      workoutLog={session.workoutLog}
                      editable={true}
                      onUpdate={(updatedWorkout) => setWorkoutLog(session.id, updatedWorkout)}
                    />
                  </div>

                  {/* Insights Tab */}
                  <div className={activeTab === 'insights' ? 'block' : 'hidden'}>
                    <div className="bg-[var(--color-surface)]">
                      {/* Analysis Section */}
                      {session.analysis && (
                        <InsightsSection title="Session Analysis" icon={BarChart3} defaultOpen={true}>
                          <SessionAnalysisComponent analysis={session.analysis} />
                        </InsightsSection>
                      )}

                      {/* Yesterday's Review */}
                      {session.knowledge?.yesterdaysReview && (
                        <InsightsSection title={`Yesterday (${session.knowledge.yesterdaysReview.periodKey})`} icon={Calendar} defaultOpen={true}>
                          <div className="text-sm">
                            <MarkdownRenderer content={session.knowledge.yesterdaysReview.summary} />
                          </div>
                        </InsightsSection>
                      )}

                      {/* Raw Knowledge */}
                      {session.knowledge && (
                        <InsightsSection
                          title="Knowledge Base"
                          icon={Sparkles}
                          count={
                            session.knowledge.events.length +
                            session.knowledge.interpretations.length +
                            session.knowledge.patterns.length +
                            session.knowledge.insights.length +
                            session.knowledge.reviews.length
                          }
                        >
                          <KnowledgeContent knowledge={session.knowledge} />
                        </InsightsSection>
                      )}

                      {/* Empty state */}
                      {!session.analysis && !session.knowledge && (
                        <div className="flex flex-col items-center justify-center py-16 px-5">
                          <Brain className="w-12 h-12 text-[var(--color-line)] mb-4" />
                          <p className="font-serif text-lg text-[var(--color-text)]">Building insights...</p>
                          <p className="text-sm text-[var(--color-muted)] mt-1">
                            Analysis will appear as you log exercises
                          </p>
                        </div>
                      )}

                      {/* Loading states */}
                      {!session.knowledge && !session.analysis && (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-muted)]">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading insights...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Non-gym sessions: standard layout */
              <>
                {/* Legacy Master Summary Card (fallback for sessions without structured data) */}
                {!session.workoutLog && !session.dietLog && (
                  <MasterSummaryCard
                    summary={session.masterSummary}
                    trackerType={session.trackerType || 'general'}
                  />
                )}

                {/* Events list */}
                {session.events.length > 0 ? (
                  <div className="divide-y divide-[var(--color-line)]">
                    {session.events.map((event) => (
                      <EventDraftRow
                        key={event.id}
                        event={event}
                        sessionId={session.id}
                        onRetry={handleRetry}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-5">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-line)] mb-4" />
                    <p className="font-serif text-lg text-[var(--color-text)]">No events yet</p>
                    <p className="text-sm text-[var(--color-muted)] mt-1">
                      Add your first event below
                    </p>
                  </div>
                )}
              </>
            )}
        </main>

        {/* Fixed EventInput at bottom (hidden for habit tracker) */}
        {session.trackerType !== 'habit' && (
          <div
            className="
              fixed bottom-0 left-0 right-0 z-20
              px-5 sm:px-7 py-4
              bg-[var(--color-bg)]
              border-t border-[var(--color-line)]
            "
          >
            <div className="max-w-2xl mx-auto">
              <SessionEventInput sessionId={session.id} />
            </div>
          </div>
        )}

        {/* Back button (uses browser history for instant nav) */}
        <BackButton className="
          fixed bottom-28 left-6
          z-20
          w-12 h-12
          flex items-center justify-center
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
          shadow-lg
          transition-all duration-200
          hover:shadow-xl hover:border-[var(--color-accent)]
          active:scale-95
        " />
      </div>
    </>
  );
}
