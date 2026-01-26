// Sessions Types

export type TrackerType = 'diet' | 'gym' | 'addiction' | 'general';

export type MenstrualCyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface MenstrualCycleInfo {
  tracking: boolean;
  lastPeriodStart?: string;  // ISO date
  cycleLengthDays: number;   // default 28
  currentPhase?: MenstrualCyclePhase;
  dayOfCycle?: number;
}

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
  // Menstrual cycle phase (if tracking enabled for female users)
  cyclePhase?: MenstrualCycleInfo;
}

export interface SessionUnderstanding {
  content: string;        // Condensed markdown output
  guide: string;          // Session guide name (e.g., "Gym Trainer", "Dietician")
  generatedAt: string;    // ISO timestamp
  inferredGoal?: string;  // When user didn't provide explicit goal
}

export interface SuggestedWorkout {
  exercises: {
    name: string;
    sets: number;
    reps: string;        // e.g., "8-10" or "5"
    weight?: string;     // e.g., "80kg" or "BW+10kg"
    notes?: string;      // e.g., "Warm-up", "Working sets"
  }[];
  reason: string;        // Why this workout is suggested
  generatedAt: string;   // ISO timestamp
}

export interface SuggestedDiet {
  meals: {
    time: string;           // "Breakfast", "Lunch", "Dinner", "Snack"
    suggestion: string;     // "2 eggs with toast and avocado"
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    notes?: string;
  }[];
  dailyTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  reason: string;
  generatedAt: string;
}

// Universal Session Analysis - domain-agnostic structured context
export interface SessionAnalysis {
  // Detected session type (used to select coach prompt)
  sessionType: TrackerType;

  // Timeline of relevant events with context
  relevantHistory: {
    date: string;
    event: string;
    highlight?: string;        // Key metric or achievement (e.g., "Bench PR 82.5kg", "1800 cal")
    preTriggers?: string[];    // What happened before (sleep, stress, etc.)
    postEffects?: string[];    // What happened after (soreness, energy, etc.)
  }[];

  // Detected patterns with trend analysis
  patterns: {
    name: string;              // e.g., "Workout Split", "Meal Timing", "Craving Triggers"
    description: string;       // What the pattern is
    trend: 'improving' | 'stable' | 'declining' | 'unknown';
    evidence: string[];        // Specific data points supporting this
    confidence: 'low' | 'medium' | 'high';
  }[];

  // Cross-domain correlations
  correlations: {
    factor: string;            // e.g., "Sleep > 7hrs", "After alcohol"
    impact: string;            // e.g., "+15% strength", "2x craving likelihood"
    direction: 'positive' | 'negative';
    occurrences: number;       // How many times observed
  }[];

  // Today's actionable plan
  todaysPlan: {
    summary: string;           // Brief overview
    items: {
      suggestion: string;      // What to do
      rationale: string;       // Why (based on data)
      metrics: { key: string; value: string }[];  // Relevant numbers (weight, calories, etc.)
    }[];
  };

  // Condensed context for the coach (markdown)
  context: string;

  // User's goals/targets extracted from UOM
  userGoals?: string;
  userTargets?: { key: string; value: string }[];

  generatedAt: string;
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
  understanding?: SessionUnderstanding; // Condensed session context (legacy)
  analysis?: SessionAnalysis; // Universal structured analysis
  isCompleted?: boolean; // true when session is finalized
  trackerType?: TrackerType; // Specialized tracker type (diet, gym, addiction, general)
  masterSummary?: string; // Master .md content for diet/gym trackers
  suggestedWorkout?: SuggestedWorkout; // AI-suggested workout for gym sessions
  suggestedDiet?: SuggestedDiet; // AI-suggested diet for diet sessions
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
  setSessionAnalysis: (sessionId: string, analysis: SessionAnalysis) => void;
  setEventLlmComment: (
    sessionId: string,
    eventId: string,
    comment: string | null,
    status: 'pending' | 'generating' | 'completed' | 'failed',
    error?: string,
    masterSummary?: string
  ) => void;
  markSessionCompleted: (sessionId: string) => void;
  setTrackerType: (sessionId: string, type: TrackerType) => void;
  updateMasterSummary: (sessionId: string, summary: string) => void;
  setSuggestedWorkout: (sessionId: string, workout: SuggestedWorkout) => void;
  setSuggestedDiet: (sessionId: string, diet: SuggestedDiet) => void;
}

export type SessionsStore = SessionsState & SessionsActions;
