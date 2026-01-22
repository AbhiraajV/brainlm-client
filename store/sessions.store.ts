import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session, SessionsState, SessionsActions, SessionsStore, SessionKnowledge, SessionUnderstanding } from '@/lib/sessions/types';

const STORAGE_KEY = 'brainlm:sessions';
const STORAGE_VERSION = 5; // Bumped for v5: EventDraft LLM suggestion fields

const initialState: SessionsState = {
  sessions: [],
};

// Helper to generate UUIDs
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Validate a session object
const isValidSession = (session: unknown): session is Session => {
  if (!session || typeof session !== 'object') return false;
  const s = session as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.title === 'string' &&
    typeof s.createdAt === 'string' &&
    typeof s.updatedAt === 'string' &&
    typeof s.sessionContext === 'string' &&
    Array.isArray(s.events)
  );
};

// Migrate session to latest schema (v3)
const migrateSession = (session: Record<string, unknown>): Session => {
  return {
    id: session.id as string,
    title: session.title as string,
    createdAt: session.createdAt as string,
    updatedAt: session.updatedAt as string,
    sessionContext: (session.sessionContext as string) || '',
    seed: session.seed as string | undefined,
    createdBy: (session.createdBy as 'manual' | 'automatic') || 'manual',
    events: (session.events as Session['events']) || [],
    knowledge: session.knowledge as SessionKnowledge | undefined,
    understanding: session.understanding as SessionUnderstanding | undefined,
  };
};

// Safe localStorage wrapper
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      console.warn('Failed to read from localStorage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {
      console.warn('Failed to write to localStorage');
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      console.warn('Failed to remove from localStorage');
    }
  },
};

export const useSessionsStore = create<SessionsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createSession: (title: string, context?: string, createdBy: 'manual' | 'automatic' = 'manual'): string => {
        const now = new Date().toISOString();
        const id = generateId();

        const newSession: Session = {
          id,
          title,
          createdAt: now,
          updatedAt: now,
          sessionContext: context || '',
          createdBy,
          events: [],
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
        }));

        return id;
      },

      updateSession: (id: string, updates: { title?: string; sessionContext?: string }): void => {
        const now = new Date().toISOString();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  ...(updates.title !== undefined && { title: updates.title }),
                  ...(updates.sessionContext !== undefined && { sessionContext: updates.sessionContext }),
                  updatedAt: now,
                }
              : session
          ),
        }));
      },

      deleteSession: (id: string): void => {
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== id),
        }));
      },

      addEventDraft: (sessionId: string, content: string): string => {
        const now = new Date().toISOString();
        const eventId = generateId();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  events: [
                    ...session.events,
                    { id: eventId, content, createdAt: now },
                  ],
                  updatedAt: now,
                }
              : session
          ),
        }));

        return eventId;
      },

      updateEventDraft: (sessionId: string, eventId: string, content: string): void => {
        const now = new Date().toISOString();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  events: session.events.map((event) =>
                    event.id === eventId ? { ...event, content } : event
                  ),
                  updatedAt: now,
                }
              : session
          ),
        }));
      },

      deleteEventDraft: (sessionId: string, eventId: string): void => {
        const now = new Date().toISOString();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  events: session.events.filter((event) => event.id !== eventId),
                  updatedAt: now,
                }
              : session
          ),
        }));
      },

      setSessionKnowledge: (sessionId: string, knowledge: SessionKnowledge): void => {
        const now = new Date().toISOString();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, knowledge, seed: knowledge.seed, updatedAt: now }
              : session
          ),
        }));
      },

      setSeed: (sessionId: string, seed: string): void => {
        const now = new Date().toISOString();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, seed, updatedAt: now }
              : session
          ),
        }));
      },

      setSessionUnderstanding: (sessionId: string, understanding: SessionUnderstanding): void => {
        const now = new Date().toISOString();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, understanding, updatedAt: now }
              : session
          ),
        }));
      },

      setEventLlmComment: (
        sessionId: string,
        eventId: string,
        comment: string | null,
        status: 'pending' | 'generating' | 'completed' | 'failed',
        error?: string
      ): void => {
        const now = new Date().toISOString();

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  events: session.events.map((event) =>
                    event.id === eventId
                      ? {
                          ...event,
                          llmComment: comment ?? undefined,
                          llmCommentStatus: status,
                          llmCommentError: error,
                        }
                      : event
                  ),
                  updatedAt: now,
                }
              : session
          ),
        }));
      },

      markSessionCompleted: (sessionId: string): void => {
        const now = new Date().toISOString();
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, isCompleted: true, updatedAt: now }
              : session
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        sessions: state.sessions,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Handle migration from older versions or corrupted data
        if (!persistedState) {
          return initialState;
        }

        try {
          const state = persistedState as { sessions?: unknown[] };
          const rawSessions = state.sessions || [];

          // Filter valid sessions and migrate to latest schema
          const validSessions = rawSessions
            .filter(isValidSession)
            .map((s) => migrateSession(s as unknown as Record<string, unknown>));

          return {
            sessions: validSessions,
          };
        } catch {
          console.warn('Failed to migrate sessions data, resetting to initial state');
          return initialState;
        }
      },
    }
  )
);

// Selectors
export const selectSessions = (state: SessionsStore) => state.sessions;
export const selectSessionById = (id: string) => (state: SessionsStore) =>
  state.sessions.find((s) => s.id === id);
