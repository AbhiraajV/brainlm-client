// Sessions Types

export interface EventDraft {
  id: string;
  content: string;
  createdAt: string; // ISO date
  // LLM suggestion fields
  llmComment?: string;           // The LLM's suggestion/comment
  llmCommentStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  llmCommentError?: string;      // Error message if failed
}

// Simplified knowledge structure for v2
export interface KnowledgeEvent {
  id: string;
  content: string;
  occurredAt: string;
}

export interface KnowledgeInterpretation {
  id: string;
  content: string;
  eventId: string;
  createdAt: string;
}

export interface KnowledgePattern {
  id: string;
  name: string;
  description: string;
}

export interface KnowledgeInsight {
  id: string;
  content: string;
  createdAt: string;
}

export interface KnowledgeReview {
  id: string;
  type: string;
  summary: string;
  periodKey: string;
}

export interface KnowledgeDailyPlan {
  id: string;
  targetDate: string;
  renderedMarkdown: string;
}

export interface SessionKnowledge {
  retrievedAt: string;
  seed: string; // The seed used for retrieval
  events: KnowledgeEvent[];
  interpretations: KnowledgeInterpretation[];
  patterns: KnowledgePattern[];
  insights: KnowledgeInsight[];
  reviews: KnowledgeReview[];
  // Additional context for goal understanding
  userBaseline?: string; // User's UOM/baseline profile
  todaysPlan?: KnowledgeDailyPlan; // Today's daily plan
  yesterdaysReview?: KnowledgeReview; // Yesterday's review
  // Today's events (all events from today, not just vector-search related)
  todaysEvents?: KnowledgeEvent[];
}

export interface SessionUnderstanding {
  content: string;        // Condensed markdown output
  guide: string;          // Session guide name (e.g., "Gym Trainer", "Dietician")
  generatedAt: string;    // ISO timestamp
  inferredGoal?: string;  // When user didn't provide explicit goal
}

export interface Session {
  id: string;
  title: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  sessionContext: string;
  seed?: string; // LLM-generated keywords
  createdBy: 'manual' | 'automatic';
  events: EventDraft[];
  knowledge?: SessionKnowledge; // Retrieved knowledge
  understanding?: SessionUnderstanding; // Condensed session context
  isCompleted?: boolean; // true when session is finalized
}

export interface SessionsState {
  sessions: Session[];
}

export interface SessionsActions {
  createSession: (title: string, context?: string, createdBy?: 'manual' | 'automatic') => string;
  updateSession: (id: string, updates: { title?: string; sessionContext?: string }) => void;
  deleteSession: (id: string) => void;
  addEventDraft: (sessionId: string, content: string) => string;
  updateEventDraft: (sessionId: string, eventId: string, content: string) => void;
  deleteEventDraft: (sessionId: string, eventId: string) => void;
  setSessionKnowledge: (sessionId: string, knowledge: SessionKnowledge) => void;
  setSeed: (sessionId: string, seed: string) => void;
  setSessionUnderstanding: (sessionId: string, understanding: SessionUnderstanding) => void;
  setEventLlmComment: (
    sessionId: string,
    eventId: string,
    comment: string | null,
    status: 'pending' | 'generating' | 'completed' | 'failed',
    error?: string
  ) => void;
  markSessionCompleted: (sessionId: string) => void;
}

export type SessionsStore = SessionsState & SessionsActions;
