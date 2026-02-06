// Sessions Types

export type TrackerType = 'diet' | 'gym' | 'addiction' | 'general' | 'habit';

// ============================================================================
// WORKOUT TRACKING TYPES
// ============================================================================

// Weight unit preferences
export type WeightUnit = 'kg' | 'lbs';

// Equipment types
export type EquipmentType =
  | 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight'
  | 'kettlebell' | 'resistance_band' | 'smith_machine' | 'ez_bar' | 'trap_bar' | 'other';

// Muscle groups
export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quadriceps' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'obliques'
  | 'lower_back' | 'traps' | 'lats' | 'full_body';

// Set types
export type SetType =
  | 'warmup' | 'working' | 'top' | 'backoff' | 'dropset' | 'superset'
  | 'rest_pause' | 'to_failure' | 'forced_reps' | 'myo_reps' | 'cluster' | 'amrap';

// Laterality for unilateral exercises
export type Laterality = 'bilateral' | 'unilateral_left' | 'unilateral_right' | 'alternating';

// Form quality rating
export type FormQuality = 'excellent' | 'good' | 'moderate' | 'poor';

// PR flags for a set
export interface PRFlags {
  weightPR?: boolean;
  repPR?: boolean;
  volumePR?: boolean;
  e1rmPR?: boolean;
}

// PR type for computed fields
export type PRType = 'weight' | 'e1rm' | 'volume' | 'reps';

// Computed fields for a set (populated by tool handlers)
export interface SetComputed {
  volume: number;              // weight * reps
  e1rm: number;                // Estimated 1RM
  isPR: boolean;
  prType?: PRType;
  previousBest?: {
    value: number;
    date: string;
  };
}

// Computed fields for an exercise
export interface ExerciseComputed {
  totalVolume: number;
  totalReps: number;
  bestE1RM: number;
  exercisePR?: {               // Best ever for this exercise
    weight: number;
    reps: number;
    e1rm: number;
    date: string;
  };
  lastSession?: {              // Last time this exercise was done
    date: string;
    topSet: { weight: number; reps: number };
  };
}

// AI-predicted targets for an exercise (populated when AI creates exercise template)
export interface ExerciseTargets {
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
  sets: number;
  rationale: string;           // AI's reasoning for these targets
  confidence: 'high' | 'medium' | 'low';
  source: 'history' | 'correlation' | 'estimation';
}

// PR summary for session-level tracking
export interface PRSummary {
  exerciseName: string;
  prType: PRType;
  newValue: number;
  previousValue: number;
  improvement: number;         // percentage
}

// Computed fields for workout session
export interface WorkoutComputed {
  totalVolume: number;
  totalTonnage: number;
  avgRPE?: number;

  // Volume trends (from historical data)
  weeklyVolumeByMuscle?: Record<MuscleGroup, number>;
  volumeTrend?: 'increasing' | 'stable' | 'decreasing';

  // Strength ratios
  pushPullRatio?: number;

  // Recovery metrics
  daysSinceMuscleGroup?: Partial<Record<MuscleGroup, number>>;
  recoveryRecommendation?: string;

  // Session PRs
  prsThisSession: PRSummary[];
}

// Tempo for controlled reps
export interface SetTempo {
  eccentric: number;
  pauseBottom: number;
  concentric: number;
  pauseTop: number;
}

// Individual set
export interface WorkoutSet {
  setNumber: number;
  setType: SetType;
  targetReps?: number;
  actualReps: number;
  weight: number;
  weightUnit: WeightUnit;
  equipmentType: EquipmentType;
  laterality: Laterality;
  rpe?: number;                // 1-10 (optional)
  rir?: number;                // Reps in reserve (optional)
  tempo?: SetTempo;
  restAfterSeconds?: number;
  prFlags?: PRFlags;
  formQuality?: FormQuality;
  painDiscomfort?: string;
  supersetWith?: string;
  completedAt?: string;
  notes?: string;
  computed?: SetComputed;      // Computed fields (populated by tool handlers)
}

// Exercise entry with sets
export interface ExerciseEntry {
  id: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipmentType: EquipmentType;
  sets: WorkoutSet[];
  notes?: string;
  orderIndex: number;
  targets?: ExerciseTargets;   // AI-predicted targets for this exercise
  computed?: ExerciseComputed; // Computed fields (populated by tool handlers)
}

// Workout day summary
export interface WorkoutDaySummary {
  totalExercises: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  totalVolumeUnit: WeightUnit;
  muscleGroupsWorked: MuscleGroup[];
  prCount: number;
}

// Main workout log (replaces masterSummary for gym)
export interface WorkoutLog {
  id: string;
  date: string;
  workoutName?: string;        // "Push Day", "Arms & Abs"
  muscleGroups: MuscleGroup[];
  exercises: ExerciseEntry[];
  summary: WorkoutDaySummary;
  preferredUnit: WeightUnit;   // Auto-detected from user input
  notes?: string;
  workoutRating?: number;      // 1-5
  createdAt: string;
  updatedAt: string;
  computed?: WorkoutComputed;  // Computed fields (session-level metrics)
  templateId?: string;         // ID of template this workout was created from
  templateName?: string;       // Name of template for display
}

// ============================================================================
// WORKOUT TEMPLATE TYPES
// ============================================================================

// Template exercise (target structure, no actual sets)
export interface TemplateExercise {
  id: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipmentType: EquipmentType;
  targetSets: number;
  targetReps: number;
  targetWeight?: number;
  targetWeightUnit?: WeightUnit;
  restSeconds?: number;
  notes?: string;
  orderIndex: number;
}

// Workout template
export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  muscleGroups: MuscleGroup[];
  exercises: TemplateExercise[];
  estimatedDuration?: number;    // minutes
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt?: string;
}

// ============================================================================
// DIET TRACKING TYPES
// ============================================================================

// Meal types
export type MealType =
  | 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack'
  | 'dinner' | 'evening_snack' | 'pre_workout' | 'post_workout' | 'other';

// Food source
export type FoodSource = 'homemade' | 'restaurant' | 'fast_food' | 'packaged' | 'meal_prep' | 'other';

// Serving units
export type ServingUnit =
  | 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece' | 'slice' | 'serving' | 'scoop';

// Core macros (always required)
export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Extended macros (commonly tracked)
export interface ExtendedMacros extends Macros {
  fiber?: number;              // g
  sugar?: number;              // g
  sodium?: number;             // mg
}

// Individual food item
export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  source: FoodSource;
  servingSize: number;
  servingUnit: ServingUnit;
  macros: Macros;
  fiber?: number;              // g
  sugar?: number;              // g
  sodium?: number;             // mg
  notes?: string;
  loggedAt: string;
}

// Meal entry
export interface MealEntry {
  id: string;
  mealType: MealType;
  time?: string;               // "12:30" or ISO timestamp
  foods: FoodItem[];
  totalMacros: Macros;
  notes?: string;
  orderIndex: number;
}

// Daily targets
export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;              // Max sugar target
  sodium?: number;             // Max sodium target (mg)
}

// Progress tracking
export interface DailyProgress {
  consumed: ExtendedMacros;
  remaining: Macros;
  percentages: { calories: number; protein: number; carbs: number; fat: number };
}

// Diet day summary
export interface DietDaySummary {
  totalMeals: number;
  totalFoods: number;
  totalMacros: Macros;
  totalFiber?: number;
  totalSugar?: number;
  totalSodium?: number;
  targets: DailyTargets;
  progress: DailyProgress;
}

// Main diet log (replaces masterSummary for diet)
export interface DietLog {
  id: string;
  date: string;
  meals: MealEntry[];
  targets: DailyTargets;
  summary: DietDaySummary;
  waterIntake?: number;        // ml
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// HABIT TRACKING TYPES
// ============================================================================

export type HabitPolarity = 'positive' | 'negative';

export interface HabitDefinition {
  id: string;              // Stable UUID across days
  name: string;
  polarity: HabitPolarity;
  orderIndex: number;
  createdAt: string;
  isArchived: boolean;
}

export interface HabitEntry {
  habitId: string;
  habitName: string;       // Denormalized for history
  polarity: HabitPolarity; // Denormalized
  status: 'pending' | 'done' | 'skipped';
  comment?: string;        // Plain text reflection
  checkedAt?: string;
}

export interface HabitDaySummary {
  totalHabits: number;
  totalAntiHabits: number;
  completedHabits: number;    // Positive habits marked done
  failedAntiHabits: number;   // Anti-habits marked done (user did the bad thing)
  skippedCount: number;
  completionRate: number;     // 0-100
  allPositivesDone: boolean;  // Trigger for completion prompt
}

export interface HabitLog {
  id: string;
  date: string;            // YYYY-MM-DD
  entries: HabitEntry[];
  summary: HabitDaySummary;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

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
  seed?: string; // Deprecated - kept for backward compatibility
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
    emotionalContext?: string; // User's emotional state
    whatWorked?: string;       // What strategy worked if applicable
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

  // THE MAIN ADDITION - detailed narrative briefing for the coach
  coachBriefing?: {
    userProfile: string;           // 3-5 paragraphs about who this person is
    whatGoesWrong: string;         // Exhaustive list of failure patterns with examples
    whyItGoesWrong: string;        // Root cause analysis for each failure
    howWeFixedItBefore: string;    // Every success strategy with specific examples
    todaysRisks: string;           // What to watch for TODAY
    recommendedApproach: string;   // How coach should handle this user
  };

  // Emotional factors affecting behavior
  emotionalFactors?: {
    trigger: string;               // What happened
    emotionalResponse: string;     // How user felt
    behavioralImpact: string;      // How it affected behavior
    frequency: number;             // How many times observed
  }[];

  // Strategies that have worked before
  whatWorkedBefore?: {
    situation: string;             // When this problem/pattern occurred
    strategy: string;              // What the user did
    outcome: string;               // Result
    timesWorked: number;           // How often it worked
  }[];

  // Root cause analysis for recurring patterns
  rootCauses?: {
    behavior: string;              // Observable pattern
    underlyingWhy: string;         // WHY this happens
    evidence: string[];            // Supporting evidence
  }[];

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
  masterSummary?: string; // Master .md content for diet/gym trackers (legacy)
  workoutLog?: WorkoutLog; // Structured workout data for gym sessions
  dietLog?: DietLog; // Structured diet data for diet sessions
  habitLog?: HabitLog; // Structured habit data for habit sessions
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
    masterSummary?: string,
    workoutLog?: WorkoutLog,
    dietLog?: DietLog
  ) => void;
  markSessionCompleted: (sessionId: string) => void;
  setTrackerType: (sessionId: string, type: TrackerType) => void;
  updateMasterSummary: (sessionId: string, summary: string) => void;
  setWorkoutLog: (sessionId: string, workoutLog: WorkoutLog) => void;
  setDietLog: (sessionId: string, dietLog: DietLog) => void;
  setHabitLog: (sessionId: string, habitLog: HabitLog) => void;
  setSuggestedWorkout: (sessionId: string, workout: SuggestedWorkout) => void;
  setSuggestedDiet: (sessionId: string, diet: SuggestedDiet) => void;
}

export type SessionsStore = SessionsState & SessionsActions;

// ============================================================================
// CLIENT-SIDE CACHE TYPES
// ============================================================================

/**
 * Timestamps for tracking when each content type was last fetched.
 * Used for delta fetching - only fetch items created AFTER these timestamps.
 */
export interface KnowledgeCacheTimestamps {
  lastInterpretationAt: string | null;  // ISO timestamp
  lastPatternAt: string | null;
  lastInsightAt: string | null;
  lastReviewAt: string | null;
  lastEventAt: string | null;
}

/**
 * Cached knowledge for a tracker type.
 * Stored client-side in localStorage via Zustand.
 */
export interface CachedKnowledge {
  knowledge: SessionKnowledge;
  seed: string;
  timestamps: KnowledgeCacheTimestamps;
  baselineHash: string | null;  // MD5 of user baseline - invalidate if changed
  generatedAt: string;          // When cache was created
  updatedAt: string;            // When cache was last updated (delta merge)
}

/**
 * Cached analysis for a tracker type.
 * Stored client-side in localStorage via Zustand.
 */
export interface CachedAnalysis {
  analysis: SessionAnalysis;
  lastEventId: string | null;   // Last completed Event ID from DB
  lastEventAt: string | null;   // Timestamp of last Event
  eventCount: number;           // Total events at cache time
  baselineHash: string | null;  // MD5 of user baseline
  generatedAt: string;
}

/**
 * PR record for an exercise
 */
export interface ExercisePR {
  weight: number;
  reps: number;
  e1rm: number;
  date: string;
  eventId?: string;
}

/**
 * Cached gym data (PR history)
 */
export interface CachedGymData {
  exercisePRs: Record<string, ExercisePR>;  // exerciseName -> PR
  lastEventId: string | null;
  lastEventAt: string | null;
  eventCount: number;
  updatedAt: string;
}

/**
 * Full cache state - stored in separate Zustand store
 */
export interface CacheState {
  knowledgeCache: Partial<Record<TrackerType, CachedKnowledge>>;
  analysisCache: Partial<Record<TrackerType, CachedAnalysis>>;
  gymDataCache: CachedGymData | null;
}

/**
 * Cache store actions
 */
export interface CacheActions {
  // Knowledge cache
  setKnowledgeCache: (trackerType: TrackerType, cache: CachedKnowledge) => void;
  updateKnowledgeCache: (trackerType: TrackerType, updates: Partial<CachedKnowledge>) => void;
  clearKnowledgeCache: (trackerType?: TrackerType) => void;

  // Analysis cache
  setAnalysisCache: (trackerType: TrackerType, cache: CachedAnalysis) => void;
  updateAnalysisCache: (trackerType: TrackerType, updates: Partial<CachedAnalysis>) => void;
  clearAnalysisCache: (trackerType?: TrackerType) => void;

  // Gym data cache
  setGymDataCache: (cache: CachedGymData) => void;
  updateExercisePR: (exerciseName: string, pr: ExercisePR) => void;
  clearGymDataCache: () => void;

  // Clear all caches
  clearAllCaches: () => void;
}

export type CacheStore = CacheState & CacheActions;
