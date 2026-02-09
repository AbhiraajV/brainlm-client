'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, SkipForward, Check, Sparkles, AlertTriangle } from 'lucide-react';
import type {
  ActivityLevel, DietGoalProfile, DailyTargets,
} from '@/lib/sessions/types';
import { calculateTDEE, toKg, toCm, recalculateTargets } from '@/lib/diet/plan-utils';
import { EditableNumber } from '@/components/ui/EditableField';
import {
  generateDietGoals,
  negotiateDietGoals,
  type NegotiationMessage,
  type GenerateDietGoalsResult,
} from '@/server/actions/diet-goal-chat.actions';
import { ChatInputBar } from '@/components/ui/ChatInputBar';
import { FixedInputContainer } from '@/components/ui/FixedInputContainer';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface DietGoalChatProps {
  initialStats?: {
    weight?: number;
    weightUnit?: 'kg' | 'lbs';
    height?: number;
    heightUnit?: 'cm' | 'ft';
    age?: number;
    gender?: string;
  };
  inferredActivity?: {
    trainingDaysPerWeek?: number;
  };
  existingProfile?: DietGoalProfile;
  onComplete: (profile: DietGoalProfile) => void;
}

const selectedStyle = 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]';
const unselectedStyle = 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]';

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function inferActivityFromDays(days: number): ActivityLevel {
  if (days <= 1) return 'lightly_active';
  if (days <= 3) return 'moderately_active';
  if (days <= 5) return 'very_active';
  return 'extremely_active';
}

type StepId = 'weight_height' | 'age_gender' | 'bodyfat' | 'activity' | 'goal_text';

interface StepDef {
  id: StepId;
  question: string;
}

const STEPS: StepDef[] = [
  { id: 'weight_height', question: "What's your weight and height?" },
  { id: 'age_gender', question: 'Age and gender?' },
  { id: 'bodyfat', question: 'Do you know your body fat %?' },
  { id: 'activity', question: 'How active are you?' },
  { id: 'goal_text', question: "Describe your nutrition goals — be specific about what you want to achieve, any dietary preferences, and how aggressive you want to be." },
];

const TOTAL_STEPS = STEPS.length;

const activityOptions: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job' },
  { value: 'lightly_active', label: 'Lightly Active', desc: '1-2x/week' },
  { value: 'moderately_active', label: 'Moderate', desc: '3-4x/week' },
  { value: 'very_active', label: 'Very Active', desc: '5-6x/week' },
  { value: 'extremely_active', label: 'Extremely Active', desc: 'Physical job' },
];

// ============================================================================
// EDITABLE TARGETS CARD
// ============================================================================

function EditableTargetsCard({
  targets,
  tdee,
  weightKg,
  gender,
  proteinPerKg,
  dietGoal,
  reasoning,
  suggestions,
  onTargetsChange,
}: {
  targets: DailyTargets;
  tdee: number;
  weightKg: number;
  gender: string;
  proteinPerKg: number;
  dietGoal: string;
  reasoning: string;
  suggestions: string[];
  onTargetsChange: (targets: DailyTargets, proteinPerKg: number) => void;
}) {
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleEdit = (field: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber', value: number) => {
    const result = recalculateTargets(targets, field, value, weightKg, gender);
    setWarnings(result.warnings);
    onTargetsChange(result.targets, result.proteinPerKg);
  };

  const carbPct = targets.calories > 0 ? Math.round((targets.carbs * 4) / targets.calories * 100) : 0;
  const fatPct = targets.calories > 0 ? Math.round((targets.fat * 9) / targets.calories * 100) : 0;

  return (
    <div className="p-3 border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-lime)]" />
          <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Your Targets</span>
        </div>
        <span className="text-[10px] text-[var(--color-muted)]/50">tap to edit</span>
      </div>

      {/* Calories headline */}
      <div className="flex items-baseline gap-2">
        <EditableNumber
          value={targets.calories}
          onConfirm={(v) => handleEdit('calories', v)}
          className="text-2xl font-medium text-[var(--color-lime)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/40 cursor-pointer"
          inputClassName="w-20 text-2xl font-medium text-[var(--color-lime)] bg-transparent border-b border-[var(--color-lime)] outline-none"
        />
        <span className="text-sm text-[var(--color-muted)]">cal/day</span>
      </div>
      <div className="text-xs text-[var(--color-muted)]">
        TDEE: {tdee} · {formatLabel(dietGoal)}
        {targets.calories < tdee && ` (-${tdee - targets.calories} deficit)`}
        {targets.calories > tdee && ` (+${targets.calories - tdee} surplus)`}
      </div>

      {/* Macros grid */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="text-center">
          <div className="text-[10px] text-[var(--color-muted)] uppercase">Protein</div>
          <div className="flex items-center justify-center gap-0.5">
            <EditableNumber value={targets.protein} onConfirm={(v) => handleEdit('protein', v)} />
            <span className="text-xs text-[var(--color-muted)]">g</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">{proteinPerKg}g/kg</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[var(--color-muted)] uppercase">Carbs</div>
          <div className="flex items-center justify-center gap-0.5">
            <EditableNumber value={targets.carbs} onConfirm={(v) => handleEdit('carbs', v)} />
            <span className="text-xs text-[var(--color-muted)]">g</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">{carbPct}%</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[var(--color-muted)] uppercase">Fat</div>
          <div className="flex items-center justify-center gap-0.5">
            <EditableNumber value={targets.fat} onConfirm={(v) => handleEdit('fat', v)} />
            <span className="text-xs text-[var(--color-muted)]">g</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">{fatPct}%</div>
        </div>
      </div>

      {/* Fiber */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <span>Fiber:</span>
        <EditableNumber value={targets.fiber ?? 25} onConfirm={(v) => handleEdit('fiber', v)} />
        <span>g</span>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1 pt-1">
          {warnings.map((w, i) => (
            <div key={i} className="text-[11px] text-[var(--color-warning,#f59e0b)] flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Reasoning */}
      <div className="text-xs text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-line)]/50 pt-2">
        {reasoning}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-0.5">
          {suggestions.map((s, i) => (
            <div key={i} className="text-[11px] text-[var(--color-muted)]/80">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DietGoalChat({
  initialStats,
  inferredActivity,
  existingProfile,
  onComplete,
}: DietGoalChatProps) {
  // --- Body stats (steps 1-4) ---
  const [weight, setWeight] = useState(existingProfile?.weight ?? initialStats?.weight ?? 0);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(existingProfile?.weightUnit ?? initialStats?.weightUnit ?? 'kg');
  const [height, setHeight] = useState(existingProfile?.height ?? initialStats?.height ?? 0);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(existingProfile?.heightUnit ?? initialStats?.heightUnit ?? 'cm');
  const [age, setAge] = useState(existingProfile?.age ?? initialStats?.age ?? 0);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(
    (existingProfile?.gender ?? initialStats?.gender as 'male' | 'female' | 'other') || 'male'
  );
  const [bodyFatPercent, setBodyFatPercent] = useState<number | undefined>(existingProfile?.bodyFatPercent);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    existingProfile?.activityLevel ??
    (inferredActivity?.trainingDaysPerWeek ? inferActivityFromDays(inferredActivity.trainingDaysPerWeek) : 'moderately_active')
  );
  const [trainingDays, setTrainingDays] = useState(existingProfile?.trainingDaysPerWeek ?? inferredActivity?.trainingDaysPerWeek ?? 4);

  // --- Goal description (step 5) ---
  const [goalText, setGoalText] = useState(() => {
    if (!existingProfile) return '';
    const parts: string[] = [formatLabel(existingProfile.dietGoal)];
    if (existingProfile.targetWeeklyChange) {
      parts.push(`${existingProfile.targetWeeklyChange}kg/week`);
    }
    parts.push(formatLabel(existingProfile.dietStyle));
    return parts.join(', ');
  });

  // --- Step navigation ---
  const [currentStep, setCurrentStep] = useState(0);

  // --- AI generation ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<GenerateDietGoalsResult | null>(null);
  const [tdee, setTdee] = useState(0);
  const generateTriggeredRef = useRef(false);

  // --- Editable targets (initialized from AI, can be manually edited) ---
  const [currentTargets, setCurrentTargets] = useState<DailyTargets | null>(null);
  const [currentProteinPerKg, setCurrentProteinPerKg] = useState(0);

  // --- Negotiation ---
  const [negotiationInput, setNegotiationInput] = useState('');
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [negotiationHistory, setNegotiationHistory] = useState<NegotiationMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentStep, aiResult, negotiationHistory]);

  // Auto-trigger AI generation after last step
  useEffect(() => {
    if (currentStep >= TOTAL_STEPS && !generateTriggeredRef.current) {
      generateTriggeredRef.current = true;
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const goNext = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const handleEditAnswer = useCallback((stepIdx: number) => {
    setCurrentStep(stepIdx);
    setAiResult(null);
    setCurrentTargets(null);
    setNegotiationHistory([]);
    generateTriggeredRef.current = false;
  }, []);

  // --- AI generation ---
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);

    const weightKg = toKg(weight, weightUnit);
    const heightCm = toCm(height, heightUnit);
    const tdeeVal = calculateTDEE(weightKg, heightCm, age, gender, activityLevel);
    setTdee(tdeeVal);

    try {
      const result = await generateDietGoals({
        weight, weightUnit, height, heightUnit, age, gender,
        bodyFatPercent,
        activityLevel,
        trainingDaysPerWeek: trainingDays,
        tdee: tdeeVal,
        weightKg,
      }, goalText);

      setAiResult(result);
      setCurrentTargets(result.targets);
      setCurrentProteinPerKg(result.proteinPerKg);
      setNegotiationHistory([{
        role: 'assistant',
        content: result.reasoning + (result.suggestions.length > 0
          ? '\n\n' + result.suggestions.map(s => `${s}`).join('\n')
          : ''),
      }]);
    } catch (err) {
      console.error('[DietGoalChat] Generation error:', err);
      // Basic fallback
      const weightKg = toKg(weight, weightUnit);
      const protein = Math.round(weightKg * 1.8);
      const carbs = Math.round((tdeeVal - protein * 4) * 0.55 / 4);
      const fat = Math.round((tdeeVal - protein * 4) * 0.45 / 9);
      const fallback: GenerateDietGoalsResult = {
        dietGoal: 'maintenance',
        dietStyle: 'flexible',
        targetWeeklyChange: 0,
        targets: { calories: protein * 4 + carbs * 4 + fat * 9, protein, carbs, fat, fiber: 25 },
        proteinPerKg: Math.round((protein / weightKg) * 10) / 10,
        reasoning: 'Could not reach AI. These are default targets based on your TDEE.',
        suggestions: [],
      };
      setAiResult(fallback);
      setCurrentTargets(fallback.targets);
      setCurrentProteinPerKg(fallback.proteinPerKg);
      setNegotiationHistory([{ role: 'assistant', content: fallback.reasoning }]);
    } finally {
      setIsGenerating(false);
    }
  }, [weight, weightUnit, height, heightUnit, age, gender, bodyFatPercent, activityLevel, trainingDays, goalText]);

  // --- Inline target editing ---
  const handleTargetsChange = useCallback((newTargets: DailyTargets, newProteinPerKg: number) => {
    setCurrentTargets(newTargets);
    setCurrentProteinPerKg(newProteinPerKg);
  }, []);

  // --- Negotiation via text ---
  const handleNegotiate = useCallback(async () => {
    if (!negotiationInput.trim() || !currentTargets || !aiResult) return;

    const msg = negotiationInput.trim();
    setNegotiationInput('');
    setNegotiationHistory(prev => [...prev, { role: 'user', content: msg }]);
    setIsNegotiating(true);

    try {
      const result = await negotiateDietGoals(
        { weight, weightUnit, gender, dietGoal: aiResult.dietGoal, dietStyle: aiResult.dietStyle, tdee },
        currentTargets,
        msg,
        negotiationHistory,
      );

      setCurrentTargets(result.updatedTargets);
      setCurrentProteinPerKg(result.proteinPerKg);
      setNegotiationHistory(prev => [...prev, { role: 'assistant', content: result.response }]);
    } catch (err) {
      console.error('[DietGoalChat] Negotiation error:', err);
      setNegotiationHistory(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again?' }]);
    } finally {
      setIsNegotiating(false);
    }
  }, [negotiationInput, currentTargets, aiResult, weight, weightUnit, gender, tdee, negotiationHistory]);

  // --- Save profile ---
  const handleSave = useCallback(() => {
    if (!currentTargets || !aiResult) return;
    setIsSaving(true);

    const now = new Date().toISOString();
    const profile: DietGoalProfile = {
      weight, weightUnit, height, heightUnit, age, gender,
      bodyFatPercent: bodyFatPercent || undefined,
      activityLevel,
      trainingDaysPerWeek: trainingDays,
      dietGoal: aiResult.dietGoal,
      dietStyle: aiResult.dietStyle,
      targetWeeklyChange: aiResult.targetWeeklyChange,
      tdee,
      targets: currentTargets,
      proteinPerKg: currentProteinPerKg,
      createdAt: now,
      updatedAt: now,
    };

    onComplete(profile);
  }, [currentTargets, currentProteinPerKg, aiResult, weight, weightUnit, height, heightUnit, age, gender, bodyFatPercent, activityLevel, trainingDays, tdee, existingProfile, onComplete]);

  // --- Build chat messages for display ---
  const messages: { role: 'assistant' | 'user'; content: string; stepIdx: number }[] = [];

  for (let i = 0; i < TOTAL_STEPS; i++) {
    if (i > currentStep) break;
    messages.push({ role: 'assistant', content: STEPS[i].question, stepIdx: i });

    if (i < currentStep) {
      const display = getAnswerDisplay(i);
      if (display) {
        messages.push({ role: 'user', content: display, stepIdx: i });
      }
    }
  }

  function getAnswerDisplay(stepIdx: number): string {
    const step = STEPS[stepIdx];
    switch (step.id) {
      case 'weight_height': return `${weight}${weightUnit}, ${height}${heightUnit}`;
      case 'age_gender': return `${age}y, ${formatLabel(gender)}`;
      case 'bodyfat': return bodyFatPercent ? `${bodyFatPercent}%` : 'Skipped';
      case 'activity': return `${formatLabel(activityLevel)}, ${trainingDays}d/wk`;
      case 'goal_text': {
        const text = goalText.trim();
        return text.length > 100 ? text.slice(0, 100) + '...' : text;
      }
      default: return '';
    }
  }

  const progress = Math.min(
    aiResult
      ? 1
      : (currentStep + 1) / (TOTAL_STEPS + 1),
    1
  ) * 100;

  const showTargets = aiResult !== null && currentTargets !== null;

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
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-32 space-y-2">
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

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="px-2.5 py-1.5 text-[13px] text-[var(--color-muted)] flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating your personalized targets...
            </div>
          </div>
        )}

        {/* Editable targets card + negotiation */}
        {showTargets && (
          <>
            <EditableTargetsCard
              targets={currentTargets}
              tdee={tdee}
              weightKg={toKg(weight, weightUnit)}
              gender={gender}
              proteinPerKg={currentProteinPerKg}
              dietGoal={aiResult.dietGoal}
              reasoning={aiResult.reasoning}
              suggestions={aiResult.suggestions}
              onTargetsChange={handleTargetsChange}
            />

            {/* Negotiation messages (skip first one — it's the reasoning in the card) */}
            {negotiationHistory.slice(1).map((msg, idx) => (
              <div key={`neg-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' ? (
                  <div className="max-w-[85%] px-2.5 py-1.5 text-[13px] text-[var(--color-text)] whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[80%] px-2.5 py-1.5 text-[13px] bg-[var(--color-lime)]/15 text-[var(--color-lime)] border border-[var(--color-lime)]/30 text-right">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {isNegotiating && (
              <div className="flex justify-start">
                <div className="px-2.5 py-1.5 text-[13px] text-[var(--color-muted)] flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Adjusting...
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fixed bottom input area */}
      <FixedInputContainer>
        {/* Questionnaire steps */}
        {currentStep < TOTAL_STEPS && (
          <StepInput
            step={STEPS[currentStep]}
            weight={weight} setWeight={setWeight}
            weightUnit={weightUnit} setWeightUnit={setWeightUnit}
            height={height} setHeight={setHeight}
            heightUnit={heightUnit} setHeightUnit={setHeightUnit}
            age={age} setAge={setAge}
            gender={gender} setGender={setGender}
            bodyFatPercent={bodyFatPercent} setBodyFatPercent={setBodyFatPercent}
            activityLevel={activityLevel} setActivityLevel={setActivityLevel}
            trainingDays={trainingDays} setTrainingDays={setTrainingDays}
            goalText={goalText} setGoalText={setGoalText}
            onNext={goNext}
          />
        )}

        {/* Negotiation + Save (after targets are generated) */}
        {showTargets && (
          <div className="space-y-2">
            <ChatInputBar
              value={negotiationInput}
              onChange={setNegotiationInput}
              onSubmit={handleNegotiate}
              placeholder="Adjust: more protein? lower calories?..."
              disabled={isNegotiating}
              isLoading={isNegotiating}
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-2.5 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] rounded-full flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save Goals
            </button>
          </div>
        )}
      </FixedInputContainer>
    </div>
  );
}

// ============================================================================
// STEP INPUT COMPONENT
// ============================================================================

interface StepInputProps {
  step: StepDef;
  weight: number; setWeight: (v: number) => void;
  weightUnit: 'kg' | 'lbs'; setWeightUnit: (v: 'kg' | 'lbs') => void;
  height: number; setHeight: (v: number) => void;
  heightUnit: 'cm' | 'ft'; setHeightUnit: (v: 'cm' | 'ft') => void;
  age: number; setAge: (v: number) => void;
  gender: 'male' | 'female' | 'other'; setGender: (v: 'male' | 'female' | 'other') => void;
  bodyFatPercent: number | undefined; setBodyFatPercent: (v: number | undefined) => void;
  activityLevel: ActivityLevel; setActivityLevel: (v: ActivityLevel) => void;
  trainingDays: number; setTrainingDays: (v: number) => void;
  goalText: string; setGoalText: (v: string) => void;
  onNext: () => void;
}

function StepInput(props: StepInputProps) {
  const { step, onNext } = props;

  switch (step.id) {
    case 'weight_height':
      return (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={props.weight || ''}
              onChange={(e) => props.setWeight(parseFloat(e.target.value) || 0)}
              placeholder="Weight"
              autoFocus
              className="flex-1 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
            />
            <div className="flex">
              {(['kg', 'lbs'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => props.setWeightUnit(u)}
                  className={`px-3 py-2 text-xs border ${u === 'lbs' ? 'border-l-0' : ''} ${props.weightUnit === u ? selectedStyle : unselectedStyle}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={props.height || ''}
              onChange={(e) => props.setHeight(parseFloat(e.target.value) || 0)}
              placeholder="Height"
              className="flex-1 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
            />
            <div className="flex">
              {(['cm', 'ft'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => props.setHeightUnit(u)}
                  className={`px-3 py-2 text-xs border ${u === 'ft' ? 'border-l-0' : ''} ${props.heightUnit === u ? selectedStyle : unselectedStyle}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onNext}
            disabled={!props.weight || !props.height}
            className="w-full py-2 text-sm font-medium bg-[var(--color-text)] text-[var(--color-bg)] disabled:opacity-30 transition-opacity"
          >
            Next
          </button>
        </div>
      );

    case 'age_gender':
      return (
        <div className="space-y-3">
          <input
            type="number"
            value={props.age || ''}
            onChange={(e) => props.setAge(parseInt(e.target.value) || 0)}
            placeholder="Age"
            autoFocus
            className="w-24 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
          />
          <div className="flex gap-2">
            {(['male', 'female', 'other'] as const).map(g => (
              <button
                key={g}
                onClick={() => props.setGender(g)}
                className={`flex-1 px-3 py-2 text-sm border transition-colors ${props.gender === g ? selectedStyle : unselectedStyle}`}
              >
                {formatLabel(g)}
              </button>
            ))}
          </div>
          <button
            onClick={onNext}
            disabled={!props.age}
            className="w-full py-2 text-sm font-medium bg-[var(--color-text)] text-[var(--color-bg)] disabled:opacity-30 transition-opacity"
          >
            Next
          </button>
        </div>
      );

    case 'bodyfat':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={props.bodyFatPercent ?? ''}
              onChange={(e) => props.setBodyFatPercent(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g. 15"
              autoFocus
              className="w-24 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
            />
            <span className="text-xs text-[var(--color-muted)]">%</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { props.setBodyFatPercent(undefined); onNext(); }}
              className="flex-1 py-2 text-sm border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)] flex items-center justify-center gap-1.5"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip
            </button>
            <button
              onClick={onNext}
              disabled={!props.bodyFatPercent}
              className="flex-1 py-2 text-sm font-medium bg-[var(--color-text)] text-[var(--color-bg)] disabled:opacity-30 transition-opacity"
            >
              Next
            </button>
          </div>
        </div>
      );

    case 'activity':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            {activityOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => props.setActivityLevel(opt.value)}
                className={`w-full px-3 py-2 text-left border transition-colors ${props.activityLevel === opt.value ? selectedStyle : unselectedStyle}`}
              >
                <span className="text-sm">{opt.label}</span>
                <span className="text-[10px] text-[var(--color-muted)]/60 ml-2">{opt.desc}</span>
              </button>
            ))}
          </div>
          <div>
            <span className="text-xs text-[var(--color-muted)] block mb-1.5">Training days/week</span>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(d => (
                <button
                  key={d}
                  onClick={() => props.setTrainingDays(d)}
                  className={`w-9 h-9 text-sm border transition-colors flex items-center justify-center ${props.trainingDays === d ? selectedStyle : unselectedStyle}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onNext}
            className="w-full py-2 text-sm font-medium bg-[var(--color-text)] text-[var(--color-bg)] transition-opacity"
          >
            Next
          </button>
        </div>
      );

    case 'goal_text':
      return (
        <div className="space-y-3">
          <textarea
            value={props.goalText}
            onChange={(e) => props.setGoalText(e.target.value)}
            placeholder="e.g. I want to lose fat while keeping muscle, stay same weight but improve body composition, lean bulk with high protein, cut aggressively for 8 weeks..."
            autoFocus
            rows={3}
            className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)] placeholder:text-[var(--color-muted)]/50 resize-none"
          />
          <button
            onClick={onNext}
            disabled={!props.goalText.trim()}
            className="w-full py-2.5 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] flex items-center justify-center gap-2 disabled:opacity-30 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            Generate My Targets
          </button>
        </div>
      );

    default:
      return null;
  }
}
