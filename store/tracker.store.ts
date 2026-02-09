import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  SessionKnowledge,
  SessionAnalysis,
  WorkoutLog,
  DietLog,
  DietDayPlan,
  HabitLog,
  MealPlanEntry,
  EventDraft,
  TrackerType,
} from '@/lib/sessions/types';

// ============================================================================
// Types
// ============================================================================

export type ActiveTrackerType = 'gym' | 'diet' | 'habit';

interface BaseTrackerState {
  events: EventDraft[];
  knowledge?: SessionKnowledge;
  analysis?: SessionAnalysis;
  masterSummary?: string;
  isCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GymTrackerState extends BaseTrackerState {
  type: 'gym';
  workoutLog?: WorkoutLog;
}

export interface DietTrackerState extends BaseTrackerState {
  type: 'diet';
  dietLog?: DietLog;
  dietDayPlan?: DietDayPlan;
  todaysMealPlan?: MealPlanEntry[];
  todaysMealPlanAnalysis?: string;
}

export interface HabitTrackerState extends BaseTrackerState {
  type: 'habit';
  habitLog?: HabitLog;
}

export type TrackerState = GymTrackerState | DietTrackerState | HabitTrackerState;

interface TrackerStoreState {
  gym: GymTrackerState | null;
  diet: DietTrackerState | null;
  habit: HabitTrackerState | null;
}

interface TrackerStoreActions {
  // Lifecycle
  initTracker: (type: ActiveTrackerType) => void;
  resetTracker: (type: ActiveTrackerType) => void;

  // Events
  addEventDraft: (type: ActiveTrackerType, content: string) => string;
  deleteEventDraft: (type: ActiveTrackerType, eventId: string) => void;
  setEventLlmComment: (
    type: ActiveTrackerType,
    eventId: string,
    comment: string | null,
    status: 'pending' | 'generating' | 'completed' | 'failed',
    error?: string,
    masterSummary?: string,
    workoutLog?: WorkoutLog,
    dietLog?: DietLog
  ) => void;

  // Knowledge & Analysis
  setKnowledge: (type: ActiveTrackerType, knowledge: SessionKnowledge) => void;
  setAnalysis: (type: ActiveTrackerType, analysis: SessionAnalysis) => void;

  // Type-specific setters
  setWorkoutLog: (log: WorkoutLog) => void;
  setDietLog: (log: DietLog) => void;
  setDietDayPlan: (plan: DietDayPlan) => void;
  setTodaysMealPlan: (meals: MealPlanEntry[], analysis?: string) => void;
  setHabitLog: (log: HabitLog) => void;
}

export type TrackerStore = TrackerStoreState & TrackerStoreActions;

// ============================================================================
// Helpers
// ============================================================================

const STORAGE_KEY = 'brainlm:trackers';
const STORAGE_VERSION = 1;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {}
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {}
  },
};

const now = () => new Date().toISOString();

/** Update a tracker slot immutably */
function updateSlot<T extends ActiveTrackerType>(
  state: TrackerStoreState,
  type: T,
  updater: (current: NonNullable<TrackerStoreState[T]>) => Partial<NonNullable<TrackerStoreState[T]>>
): Partial<TrackerStoreState> {
  const current = state[type];
  if (!current) return {};
  return {
    [type]: { ...current, ...updater(current as NonNullable<TrackerStoreState[T]>), updatedAt: now() },
  };
}

// ============================================================================
// Store
// ============================================================================

const initialState: TrackerStoreState = {
  gym: null,
  diet: null,
  habit: null,
};

export const useTrackerStore = create<TrackerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // -- Lifecycle ----------------------------------------------------------

      initTracker: (type) => {
        const existing = get()[type];
        if (existing && !existing.isCompleted) return; // already active
        const ts = now();
        const base: BaseTrackerState = {
          events: [],
          createdAt: ts,
          updatedAt: ts,
        };
        if (type === 'gym') set({ gym: { ...base, type: 'gym' } });
        else if (type === 'diet') set({ diet: { ...base, type: 'diet' } });
        else if (type === 'habit') set({ habit: { ...base, type: 'habit' } });
      },

      resetTracker: (type) => {
        set({ [type]: null });
      },

      // -- Events -------------------------------------------------------------

      addEventDraft: (type, content) => {
        const eventId = generateId();
        set((s) => updateSlot(s, type, (cur) => ({
          events: [...cur.events, { id: eventId, content, createdAt: now() }],
        })));
        return eventId;
      },

      deleteEventDraft: (type, eventId) => {
        set((s) => updateSlot(s, type, (cur) => ({
          events: cur.events.filter((e) => e.id !== eventId),
        })));
      },

      setEventLlmComment: (type, eventId, comment, status, error, masterSummary, workoutLog, dietLog) => {
        set((s) => {
          const current = s[type];
          if (!current) return {};

          const updatedEvents = current.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  llmComment: comment ?? undefined,
                  llmCommentStatus: status,
                  llmCommentError: error,
                }
              : event
          );

          const updates: Record<string, unknown> = {
            events: updatedEvents,
            updatedAt: now(),
          };
          if (masterSummary !== undefined) updates.masterSummary = masterSummary;
          if (workoutLog !== undefined && type === 'gym') updates.workoutLog = workoutLog;
          if (dietLog !== undefined && type === 'diet') updates.dietLog = dietLog;

          return { [type]: { ...current, ...updates } };
        });
      },

      // -- Knowledge & Analysis -----------------------------------------------

      setKnowledge: (type, knowledge) => {
        set((s) => updateSlot(s, type, () => ({ knowledge })));
      },

      setAnalysis: (type, analysis) => {
        set((s) => updateSlot(s, type, () => ({ analysis })));
      },

      // -- Type-specific setters ----------------------------------------------

      setWorkoutLog: (log) => {
        set((s) => updateSlot(s, 'gym', () => ({ workoutLog: log })));
      },

      setDietLog: (log) => {
        set((s) => updateSlot(s, 'diet', () => ({ dietLog: log })));
      },

      setDietDayPlan: (plan) => {
        set((s) => updateSlot(s, 'diet', () => ({ dietDayPlan: plan })));
      },

      setTodaysMealPlan: (meals, analysis) => {
        set((s) => updateSlot(s, 'diet', () => ({
          todaysMealPlan: meals,
          ...(analysis !== undefined && { todaysMealPlanAnalysis: analysis }),
        })));
      },

      setHabitLog: (log) => {
        set((s) => updateSlot(s, 'habit', () => ({ habitLog: log })));
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        gym: state.gym,
        diet: state.diet,
        habit: state.habit,
      }),
      migrate: (persisted: unknown, version: number) => {
        if (!persisted) return initialState;

        // v0 → v1: one-time migration from old sessions store
        if (version === 0 || !version) {
          try {
            const raw = safeStorage.getItem('brainlm:sessions');
            if (raw) {
              const parsed = JSON.parse(raw);
              const sessions = parsed?.state?.sessions as Array<Record<string, unknown>> | undefined;
              if (sessions && Array.isArray(sessions)) {
                const result: TrackerStoreState = { gym: null, diet: null, habit: null };
                for (const s of sessions) {
                  if (s.isCompleted) continue;
                  const tt = s.trackerType as string;
                  const events = (s.events as EventDraft[]) || [];
                  const base: BaseTrackerState = {
                    events,
                    knowledge: s.knowledge as SessionKnowledge | undefined,
                    analysis: s.analysis as SessionAnalysis | undefined,
                    masterSummary: s.masterSummary as string | undefined,
                    createdAt: s.createdAt as string,
                    updatedAt: s.updatedAt as string,
                  };
                  if (tt === 'gym' && !result.gym) {
                    result.gym = { ...base, type: 'gym', workoutLog: s.workoutLog as WorkoutLog | undefined };
                  } else if (tt === 'diet' && !result.diet) {
                    result.diet = {
                      ...base,
                      type: 'diet',
                      dietLog: s.dietLog as DietLog | undefined,
                      dietDayPlan: s.dietDayPlan as DietDayPlan | undefined,
                      todaysMealPlan: s.todaysMealPlan as MealPlanEntry[] | undefined,
                      todaysMealPlanAnalysis: s.todaysMealPlanAnalysis as string | undefined,
                    };
                  } else if (tt === 'habit' && !result.habit) {
                    result.habit = { ...base, type: 'habit', habitLog: s.habitLog as HabitLog | undefined };
                  }
                }
                return result;
              }
            }
          } catch {}
        }

        return persisted as TrackerStoreState;
      },
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const useGymState = () => useTrackerStore((s) => s.gym);
export const useDietState = () => useTrackerStore((s) => s.diet);
export const useHabitState = () => useTrackerStore((s) => s.habit);

export const useTrackerState = (type: ActiveTrackerType) =>
  useTrackerStore((s) => s[type]);
