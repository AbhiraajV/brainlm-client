'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Pencil, ArrowUp, SkipForward } from 'lucide-react';
import type {
  TrainingGoal, ExperienceLevel, EquipmentAccess, SplitType,
  CardioLevel, MuscleGroup, WorkoutPreferences,
} from '@/lib/sessions/types';

interface WorkoutQuestionnaireProps {
  onComplete: (preferences: WorkoutPreferences) => void;
  isGenerating?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const muscleGroupColors: Partial<Record<MuscleGroup, string>> = {
  chest: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)] border-[var(--color-coral)]/30',
  back: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)] border-[var(--color-mint)]/30',
  shoulders: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)] border-[var(--color-coral)]/30',
  biceps: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)] border-[var(--color-lime)]/30',
  triceps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)] border-[var(--color-coral)]/30',
  forearms: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)] border-[var(--color-lime)]/30',
  quadriceps: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)] border-[var(--color-mint)]/30',
  hamstrings: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)] border-[var(--color-mint)]/30',
  glutes: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)] border-[var(--color-coral)]/30',
  calves: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)] border-[var(--color-lime)]/30',
  abs: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)] border-[var(--color-mint)]/30',
  obliques: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)] border-[var(--color-mint)]/30',
  lower_back: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)] border-[var(--color-lime)]/30',
  traps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)] border-[var(--color-coral)]/30',
  lats: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)] border-[var(--color-mint)]/30',
  full_body: 'bg-[var(--color-line)] text-[var(--color-muted)] border-[var(--color-line)]',
};

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
  'lower_back', 'traps', 'lats',
];

const selectedStyle = 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]';
const unselectedStyle = 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]';

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function recommendSplit(goal: TrainingGoal, days: number): SplitType {
  if (goal === 'other') return 'custom';
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  if (days === 5) return 'ppl';
  return 'ppl';
}

// ============================================================================
// STEP DEFINITIONS
// ============================================================================

type StepType = 'grid' | 'grid-multi' | 'number-row' | 'number-preset' | 'chips' | 'vertical' | 'text';

interface StepOption {
  value: string;
  label: string;
  isOther?: boolean;
  recommended?: boolean; // set dynamically for split step
  description?: string; // for vertical options like cardio
}

interface StepDef {
  id: string;
  question: string;
  type: StepType;
  optional?: boolean;
  options?: StepOption[];
  placeholder?: string; // for text steps
  chipColorFn?: (value: string) => string; // for chip styling
  disabledFn?: (value: string, answers: Answers) => boolean; // disable certain chips
}

const GOAL_OPTIONS: StepOption[] = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'strength', label: 'Strength' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'body_recomp', label: 'Body Recomp' },
  { value: 'other', label: 'Other', isOther: true },
];

const EXPERIENCE_OPTIONS: StepOption[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'other', label: 'Other', isOther: true },
];

const EQUIPMENT_OPTIONS: StepOption[] = [
  { value: 'full_gym', label: 'Full Gym' },
  { value: 'home_gym', label: 'Home Gym' },
  { value: 'dumbbells_only', label: 'Dumbbells Only' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'other', label: 'Other', isOther: true },
];

const DAYS_OPTIONS: StepOption[] = [1, 2, 3, 4, 5, 6, 7].map(d => ({ value: String(d), label: String(d) }));

const DURATION_OPTIONS: StepOption[] = [
  { value: '30', label: '30m' },
  { value: '45', label: '45m' },
  { value: '60', label: '60m' },
  { value: '90', label: '90m' },
  { value: 'other', label: 'Other', isOther: true },
];

const MUSCLE_CHIP_OPTIONS: StepOption[] = MUSCLE_GROUPS.map(mg => ({
  value: mg, label: formatLabel(mg),
}));

const SPLIT_OPTIONS: StepOption[] = [
  { value: 'ppl', label: 'Push / Pull / Legs' },
  { value: 'upper_lower', label: 'Upper / Lower' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'bro_split', label: 'Bro Split' },
  { value: 'push_pull', label: 'Push / Pull' },
  { value: 'custom', label: 'Custom', isOther: true },
];

const CARDIO_OPTIONS: StepOption[] = [
  { value: 'none', label: 'None' },
  { value: 'light', label: 'Light', description: 'Warmup only' },
  { value: 'moderate', label: 'Moderate', description: 'End of session' },
  { value: 'heavy', label: 'Heavy', description: 'Dedicated days' },
  { value: 'other', label: 'Other', isOther: true },
];

const STEPS: StepDef[] = [
  { id: 'goal', question: "What's your training goal?", type: 'grid-multi', options: GOAL_OPTIONS },
  { id: 'experience', question: 'Experience level?', type: 'grid', options: EXPERIENCE_OPTIONS },
  { id: 'equipment', question: 'What equipment do you have access to?', type: 'grid-multi', options: EQUIPMENT_OPTIONS },
  { id: 'days', question: 'How many days per week?', type: 'number-row', options: DAYS_OPTIONS },
  { id: 'duration', question: 'Session duration?', type: 'number-preset', options: DURATION_OPTIONS },
  { id: 'focus', question: 'Any muscles to emphasize?', type: 'chips', optional: true, options: MUSCLE_CHIP_OPTIONS,
    chipColorFn: (v) => muscleGroupColors[v as MuscleGroup] || '',
    disabledFn: (v, ans) => ((ans.deprioritize as string[]) || []).includes(v),
  },
  { id: 'deprioritize', question: 'Any muscles to deprioritize?', type: 'chips', optional: true, options: MUSCLE_CHIP_OPTIONS,
    chipColorFn: (v) => muscleGroupColors[v as MuscleGroup] || '',
    disabledFn: (v, ans) => ((ans.focus as string[]) || []).includes(v),
  },
  { id: 'split', question: 'What split works for you?', type: 'vertical', options: SPLIT_OPTIONS },
  { id: 'cardio', question: 'How much cardio?', type: 'vertical', options: CARDIO_OPTIONS },
  { id: 'notes', question: 'Any injuries or special notes?', type: 'text', optional: true, placeholder: 'Dodgy left shoulder, prefer supersets...' },
];

const TOTAL_STEPS = STEPS.length;

// ============================================================================
// TYPES
// ============================================================================

type AnswerValue = string | string[] | number;
type Answers = Record<string, AnswerValue>;
type CustomDescs = NonNullable<WorkoutPreferences['customDescriptions']>;

// Which custom field each step maps to
const CUSTOM_FIELD_MAP: Record<string, keyof CustomDescs> = {
  goal: 'trainingGoal',
  experience: 'experienceLevel',
  equipment: 'equipmentAccess',
  duration: 'sessionDuration',
  split: 'splitType',
  cardio: 'cardioLevel',
};

// ============================================================================
// HELPERS
// ============================================================================

function formatAnswerDisplay(step: StepDef, answer: AnswerValue, customDescs: CustomDescs): string {
  if (step.type === 'text') return (answer as string) || 'Skipped';
  if (step.type === 'chips') {
    const arr = answer as string[];
    if (arr.length === 0) return 'Skipped';
    return arr.map(formatLabel).join(', ');
  }
  if (step.type === 'number-row') return `${answer} days`;
  if (step.type === 'number-preset') {
    if (answer === 'other') {
      const customVal = customDescs.sessionDuration;
      return customVal || 'Custom';
    }
    return `${answer} min`;
  }
  // grid / grid-multi / vertical
  if (Array.isArray(answer)) {
    return answer.map(v => {
      if (v === 'other' || v === 'custom') {
        const field = CUSTOM_FIELD_MAP[step.id];
        const customText = field ? customDescs[field] : undefined;
        return customText ? `Other: ${customText}` : 'Other';
      }
      const opt = step.options?.find(o => o.value === v);
      return opt?.label || formatLabel(v);
    }).join(', ');
  }
  const val = answer as string;
  if (val === 'other' || val === 'custom') {
    const field = CUSTOM_FIELD_MAP[step.id];
    const customText = field ? customDescs[field] : undefined;
    return customText ? `Other: ${customText}` : 'Other';
  }
  const opt = step.options?.find(o => o.value === val);
  return opt?.label || formatLabel(val);
}

function CustomInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-lime)]/30 focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)] placeholder:text-[var(--color-muted)]/50"
    />
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function WorkoutQuestionnaire({ onComplete, isGenerating }: WorkoutQuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [customDescriptions, setCustomDescriptions] = useState<CustomDescs>({});
  const [textInput, setTextInput] = useState('');
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [showingCustom, setShowingCustom] = useState<string | null>(null); // step id showing custom input

  // For multiselect steps, track pending selections before "Continue"
  const [pendingMulti, setPendingMulti] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // All steps answered → show review
  const allAnswered = currentStep >= TOTAL_STEPS;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentStep, answers, allAnswered]);

  // Sync pending multi when step changes
  useEffect(() => {
    if (currentStep < TOTAL_STEPS) {
      const step = STEPS[currentStep];
      if (step.type === 'grid-multi' || step.type === 'chips') {
        const existing = answers[step.id];
        setPendingMulti(Array.isArray(existing) ? [...existing] : []);
      }
    }
  }, [currentStep, answers]);

  const setCustomField = useCallback((field: keyof CustomDescs, value: string) => {
    setCustomDescriptions(prev => ({ ...prev, [field]: value }));
  }, []);

  // --- Answer handlers ---

  const commitAnswer = useCallback((stepIdx: number, value: AnswerValue) => {
    const step = STEPS[stepIdx];
    setAnswers(prev => {
      const next = { ...prev };
      // Clear answers for steps after this one
      for (let i = stepIdx + 1; i < TOTAL_STEPS; i++) {
        delete next[STEPS[i].id];
      }
      next[step.id] = value;
      return next;
    });
    setShowingCustom(null);
    setTextInput('');
    setCustomDurationInput('');

    // Auto-recommend split when reaching split step
    const nextIdx = stepIdx + 1;
    if (nextIdx < TOTAL_STEPS && STEPS[nextIdx].id === 'split') {
      const goalAnswer = stepIdx === 0 ? value : answers.goal;
      const daysAnswer = answers.days;
      if (goalAnswer && daysAnswer) {
        const primaryGoal = Array.isArray(goalAnswer) ? goalAnswer[0] : goalAnswer;
        if (primaryGoal && primaryGoal !== 'other') {
          // Pre-select recommended split (user can change it)
          const rec = recommendSplit(primaryGoal as TrainingGoal, Number(daysAnswer));
          setAnswers(prev => ({ ...prev, [step.id]: value, split: rec }));
        }
      }
    }

    setCurrentStep(nextIdx);
  }, [answers]);

  const handleSingleSelect = useCallback((stepIdx: number, value: string) => {
    const step = STEPS[stepIdx];
    const opt = step.options?.find(o => o.value === value);
    if (opt?.isOther) {
      setShowingCustom(step.id);
      // For single-select "other", we still need to commit once they provide custom text
      // Set a temporary answer so the bubble shows
      if (step.type === 'number-preset') {
        setCustomDurationInput('');
        // Don't commit yet — wait for custom input
        return;
      }
      return;
    }
    commitAnswer(stepIdx, value);
  }, [commitAnswer]);

  const handleMultiToggle = useCallback((value: string) => {
    setPendingMulti(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value);
      return [...prev, value];
    });
  }, []);

  const handleMultiContinue = useCallback((stepIdx: number) => {
    commitAnswer(stepIdx, pendingMulti);
  }, [commitAnswer, pendingMulti]);

  const handleSkip = useCallback((stepIdx: number) => {
    const step = STEPS[stepIdx];
    if (step.type === 'chips') {
      commitAnswer(stepIdx, []);
    } else if (step.type === 'text') {
      commitAnswer(stepIdx, '');
    }
  }, [commitAnswer]);

  const handleTextSubmit = useCallback((stepIdx: number) => {
    commitAnswer(stepIdx, textInput.trim());
  }, [commitAnswer, textInput]);

  const handleCustomOtherSubmit = useCallback((stepIdx: number) => {
    const step = STEPS[stepIdx];
    const field = CUSTOM_FIELD_MAP[step.id];
    if (step.type === 'number-preset') {
      const minutes = parseInt(customDurationInput);
      if (!minutes || minutes < 10) return;
      if (field) setCustomField(field, `${minutes} minutes`);
      commitAnswer(stepIdx, String(minutes));
    } else {
      // For grid/vertical "Other" — commit 'other' as the value
      // For grid-multi, add 'other' to pending
      if (step.type === 'grid-multi') {
        if (!pendingMulti.includes('other')) {
          setPendingMulti(prev => [...prev, 'other']);
        }
        setShowingCustom(null);
      } else {
        commitAnswer(stepIdx, step.id === 'split' ? 'custom' : 'other');
      }
    }
  }, [commitAnswer, customDurationInput, pendingMulti, setCustomField]);

  // Edit a previous answer by tapping its bubble
  const handleEditAnswer = useCallback((stepIdx: number) => {
    if (stepIdx < 0) return;
    // Clear answers from stepIdx onward
    setAnswers(prev => {
      const next = { ...prev };
      for (let i = stepIdx; i < TOTAL_STEPS; i++) {
        delete next[STEPS[i].id];
      }
      return next;
    });
    setShowingCustom(null);
    setCurrentStep(stepIdx);
  }, []);

  // Build final preferences and generate
  const handleGenerate = useCallback(() => {
    const goalRaw = answers.goal;
    const goal = Array.isArray(goalRaw) ? goalRaw as TrainingGoal[] : goalRaw as TrainingGoal;
    const equipRaw = answers.equipment;
    const equip = Array.isArray(equipRaw) ? equipRaw as EquipmentAccess[] : equipRaw as EquipmentAccess;

    const goals = Array.isArray(goal) ? goal : [goal];
    const equips = Array.isArray(equip) ? equip : [equip];
    const hasCustom = goals.includes('other') ||
      (answers.experience as string) === 'other' ||
      equips.includes('other') ||
      (answers.split as string) === 'custom' ||
      (answers.cardio as string) === 'other' ||
      ![30, 45, 60, 90].includes(Number(answers.duration));

    onComplete({
      trainingGoal: goal,
      experienceLevel: answers.experience as ExperienceLevel,
      equipmentAccess: equip,
      daysPerWeek: Number(answers.days),
      sessionDuration: Number(answers.duration),
      focusAreas: (answers.focus as MuscleGroup[]) || [],
      deprioritizeAreas: (answers.deprioritize as MuscleGroup[]) || [],
      splitType: answers.split as SplitType,
      cardioLevel: answers.cardio as CardioLevel,
      injuries: (answers.notes as string)?.trim() || undefined,
      additionalNotes: undefined,
      customDescriptions: hasCustom ? customDescriptions : undefined,
    });
  }, [answers, customDescriptions, onComplete]);

  // --- Derive chat messages ---

  const messages: { role: 'assistant' | 'user'; content: string; stepIdx: number }[] = [];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const step = STEPS[i];
    // Only show question if we've reached this step
    if (i > currentStep) break;

    messages.push({ role: 'assistant', content: step.question, stepIdx: i });

    if (answers[step.id] !== undefined) {
      messages.push({
        role: 'user',
        content: formatAnswerDisplay(step, answers[step.id], customDescriptions),
        stepIdx: i,
      });
    }
  }

  // If all answered, show review message
  if (allAnswered) {
    messages.push({ role: 'assistant', content: "Here's your plan summary:", stepIdx: -1 });
  }

  // Current step info
  const activeStep = currentStep < TOTAL_STEPS ? STEPS[currentStep] : null;

  // For split step, compute recommended
  const getRecommendedSplit = (): SplitType | null => {
    const goalRaw = answers.goal;
    const daysRaw = answers.days;
    if (!goalRaw || !daysRaw) return null;
    const primaryGoal = Array.isArray(goalRaw) ? goalRaw[0] : goalRaw;
    if (primaryGoal === 'other') return null;
    return recommendSplit(primaryGoal as TrainingGoal, Number(daysRaw));
  };

  const progress = Math.min((currentStep + 1) / (TOTAL_STEPS + 1), 1) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--color-line)]">
        <div
          className="h-full bg-[var(--color-lime)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Chat area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' ? (
              <div className="max-w-[85%] px-2.5 py-1.5 text-[13px] text-[var(--color-text)]">
                {msg.content}
              </div>
            ) : (
              <button
                onClick={() => handleEditAnswer(msg.stepIdx)}
                className="max-w-[80%] px-2.5 py-1.5 text-[13px] bg-[var(--color-lime)]/15 text-[var(--color-lime)] border border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/25 transition-colors text-right"
              >
                {msg.content}
              </button>
            )}
          </div>
        ))}

        {/* Review summary card */}
        {allAnswered && (
          <div className="space-y-1.5 py-2">
            <ReviewRow label="Goal" value={formatAnswerDisplay(STEPS[0], answers.goal, customDescriptions)} />
            <ReviewRow label="Experience" value={formatAnswerDisplay(STEPS[1], answers.experience, customDescriptions)} />
            <ReviewRow label="Equipment" value={formatAnswerDisplay(STEPS[2], answers.equipment, customDescriptions)} />
            <ReviewRow label="Schedule" value={`${answers.days} days/wk, ${answers.duration} min`} />
            {(answers.focus as string[])?.length > 0 && (
              <ReviewRow label="Emphasize" value={(answers.focus as string[]).map(formatLabel).join(', ')} variant="lime" />
            )}
            {(answers.deprioritize as string[])?.length > 0 && (
              <ReviewRow label="Deprioritize" value={(answers.deprioritize as string[]).map(formatLabel).join(', ')} variant="muted" />
            )}
            <ReviewRow label="Split" value={formatAnswerDisplay(STEPS[7], answers.split, customDescriptions)} />
            <ReviewRow label="Cardio" value={formatAnswerDisplay(STEPS[8], answers.cardio, customDescriptions)} />
            {answers.notes && (
              <ReviewRow label="Notes" value={answers.notes as string} variant="muted" />
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom options area */}
      <div className="border-t border-[var(--color-line)] px-4 py-3 space-y-2">
        {/* Active step input */}
        {activeStep && !showingCustom && (
          <>
            {/* Grid single select */}
            {activeStep.type === 'grid' && (
              <div className="grid grid-cols-2 gap-2">
                {activeStep.options!.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSingleSelect(currentStep, opt.value)}
                    className={`px-3 py-2.5 text-sm border transition-colors flex items-center justify-center gap-1.5 ${unselectedStyle}`}
                  >
                    {opt.isOther && <Pencil className="w-3 h-3" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Grid multi select */}
            {activeStep.type === 'grid-multi' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {activeStep.options!.map((opt) => {
                    const isSelected = pendingMulti.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          if (opt.isOther) {
                            setShowingCustom(activeStep.id);
                            const field = CUSTOM_FIELD_MAP[activeStep.id];
                            if (field && !customDescriptions[field]) {
                              // Show custom input
                            }
                            return;
                          }
                          handleMultiToggle(opt.value);
                        }}
                        className={`px-3 py-2.5 text-sm border transition-colors flex items-center justify-center gap-1.5 ${
                          isSelected ? selectedStyle : opt.isOther && pendingMulti.includes('other') ? selectedStyle : unselectedStyle
                        }`}
                      >
                        {opt.isOther && <Pencil className="w-3 h-3" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {pendingMulti.length > 0 && (
                  <button
                    onClick={() => handleMultiContinue(currentStep)}
                    className="w-full py-2 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] transition-opacity"
                  >
                    Continue
                  </button>
                )}
              </>
            )}

            {/* Number row (days) */}
            {activeStep.type === 'number-row' && (
              <div className="flex gap-2 justify-center">
                {activeStep.options!.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => commitAnswer(currentStep, opt.value)}
                    className={`w-10 h-10 text-sm border transition-colors flex items-center justify-center ${unselectedStyle}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Number preset (duration) */}
            {activeStep.type === 'number-preset' && (
              <div className="grid grid-cols-2 gap-2">
                {activeStep.options!.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (opt.isOther) {
                        setShowingCustom(activeStep.id);
                        setCustomDurationInput('');
                        return;
                      }
                      commitAnswer(currentStep, opt.value);
                    }}
                    className={`px-3 py-2.5 text-sm border transition-colors flex items-center justify-center gap-1.5 ${unselectedStyle}`}
                  >
                    {opt.isOther && <Pencil className="w-3 h-3" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Chips (muscles) */}
            {activeStep.type === 'chips' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {activeStep.options!.map((opt) => {
                    const isSelected = pendingMulti.includes(opt.value);
                    const isDisabled = activeStep.disabledFn?.(opt.value, answers) ?? false;
                    const chipColor = activeStep.chipColorFn?.(opt.value) || '';
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleMultiToggle(opt.value)}
                        disabled={isDisabled}
                        className={`px-2 py-1 text-[11px] border transition-colors ${
                          isSelected
                            ? chipColor
                            : isDisabled
                            ? 'border-[var(--color-line)] text-[var(--color-muted)]/30 opacity-40'
                            : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSkip(currentStep)}
                    className="flex-1 py-2 text-sm border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip
                  </button>
                  {pendingMulti.length > 0 && (
                    <button
                      onClick={() => handleMultiContinue(currentStep)}
                      className="flex-1 py-2 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] transition-opacity"
                    >
                      Continue
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Vertical list (split, cardio) */}
            {activeStep.type === 'vertical' && (
              <div className="space-y-1.5">
                {activeStep.options!.map((opt) => {
                  const isRecommended = activeStep.id === 'split' && getRecommendedSplit() === opt.value;
                  const isPreSelected = answers[activeStep.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (opt.isOther) {
                          setShowingCustom(activeStep.id);
                          return;
                        }
                        commitAnswer(currentStep, opt.value);
                      }}
                      className={`w-full px-3 py-2.5 text-sm text-left border transition-colors flex items-center justify-between ${
                        isPreSelected ? selectedStyle : unselectedStyle
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {opt.isOther && <Pencil className="w-3 h-3" />}
                        {opt.label}
                        {opt.description && (
                          <span className="text-[var(--color-muted)]/60 text-xs"> — {opt.description}</span>
                        )}
                      </span>
                      {isRecommended && (
                        <span className="text-[10px] text-[var(--color-lime)]/70">Recommended</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Text input (notes) */}
            {activeStep.type === 'text' && (
              <div className="flex gap-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textInput.trim()) handleTextSubmit(currentStep);
                  }}
                  placeholder={activeStep.placeholder || 'Type here...'}
                  autoFocus
                  className="flex-1 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)] placeholder:text-[var(--color-muted)]/50"
                />
                <button
                  onClick={() => handleSkip(currentStep)}
                  className="px-3 py-2 text-sm border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)] transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleTextSubmit(currentStep)}
                  disabled={!textInput.trim()}
                  className="px-3 py-2 text-sm border border-[var(--color-lime)]/50 text-[var(--color-lime)] hover:bg-[var(--color-lime)]/10 disabled:opacity-30 transition-colors"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Custom input overlay (for "Other" selections) */}
        {showingCustom && activeStep && (
          <div className="space-y-2">
            {showingCustom === 'duration' ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="number"
                  min={10}
                  max={240}
                  value={customDurationInput}
                  onChange={(e) => setCustomDurationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomOtherSubmit(currentStep);
                  }}
                  placeholder="Minutes"
                  className="flex-1 px-3 py-2 text-sm bg-transparent border border-[var(--color-lime)]/30 focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
                />
                <span className="text-xs text-[var(--color-muted)]">min</span>
                <button
                  onClick={() => handleCustomOtherSubmit(currentStep)}
                  disabled={!customDurationInput || parseInt(customDurationInput) < 10}
                  className="px-3 py-2 text-sm border border-[var(--color-lime)]/50 text-[var(--color-lime)] hover:bg-[var(--color-lime)]/10 disabled:opacity-30 transition-colors"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <CustomInput
                  value={customDescriptions[CUSTOM_FIELD_MAP[showingCustom]] || ''}
                  onChange={(v) => {
                    const field = CUSTOM_FIELD_MAP[showingCustom];
                    if (field) setCustomField(field, v);
                  }}
                  placeholder={
                    showingCustom === 'goal' ? 'Describe your goal...' :
                    showingCustom === 'experience' ? 'Describe your experience...' :
                    showingCustom === 'equipment' ? 'Describe your setup...' :
                    showingCustom === 'split' ? 'Describe your split (e.g., Arnold split, PHUL...)' :
                    showingCustom === 'cardio' ? 'Describe your cardio preferences...' :
                    'Describe...'
                  }
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowingCustom(null)}
                    className="flex-1 py-2 text-sm border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleCustomOtherSubmit(currentStep)}
                    disabled={!customDescriptions[CUSTOM_FIELD_MAP[showingCustom]]}
                    className="flex-1 py-2 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] disabled:opacity-30 transition-opacity"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Generate button (when all answered) */}
        {allAnswered && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Plan...
              </>
            ) : (
              'Generate Plan'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ReviewRow({ label, value, variant }: { label: string; value: string; variant?: 'lime' | 'muted' }) {
  const valueColor = variant === 'lime'
    ? 'text-[var(--color-lime)]'
    : variant === 'muted'
    ? 'text-[var(--color-muted)]'
    : 'text-[var(--color-text)]';

  return (
    <div className="flex items-baseline gap-2 px-1">
      <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider min-w-[70px]">{label}</span>
      <span className={`text-xs ${valueColor}`}>{value}</span>
    </div>
  );
}
