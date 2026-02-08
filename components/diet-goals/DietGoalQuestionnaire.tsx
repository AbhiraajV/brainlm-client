'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { DietGoal, ActivityLevel, DietStyle, DietGoalProfile, DailyTargets } from '@/lib/sessions/types';
import { calculateTDEE, calculateMacroTargets, toKg, toCm } from '@/lib/diet/plan-utils';

interface DietGoalQuestionnaireProps {
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
    activityLevel?: ActivityLevel;
  };
  existingProfile?: DietGoalProfile;
  onComplete: (profile: DietGoalProfile) => void;
}

const TOTAL_STEPS = 5;

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

// Goal descriptions for the cards
const goalInfo: Record<DietGoal, { label: string; desc: string }> = {
  weight_loss: { label: 'Weight Loss', desc: 'Lose fat while preserving muscle' },
  muscle_gain: { label: 'Muscle Gain', desc: 'Build muscle with a calorie surplus' },
  maintenance: { label: 'Maintenance', desc: 'Maintain current weight and composition' },
  body_recomp: { label: 'Body Recomp', desc: 'Lose fat and build muscle simultaneously' },
  performance: { label: 'Performance', desc: 'Optimize for athletic performance' },
  health: { label: 'Health', desc: 'General health and longevity focus' },
};

const styleInfo: Record<DietStyle, { label: string; desc: string }> = {
  flexible: { label: 'Flexible', desc: 'IIFYM — hit your macros however you like' },
  high_protein: { label: 'High Protein', desc: 'Extra protein for recovery and satiety' },
  low_carb: { label: 'Low Carb', desc: 'Reduced carbs, higher fat' },
  keto: { label: 'Keto', desc: 'Very low carb, high fat (<10% carbs)' },
  balanced: { label: 'Balanced', desc: 'Even macro distribution' },
  high_carb: { label: 'High Carb', desc: 'Carb-focused for endurance/performance' },
};

const activityInfo: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: 'Sedentary', desc: 'Desk job, little exercise' },
  lightly_active: { label: 'Lightly Active', desc: 'Light exercise 1-2x/week' },
  moderately_active: { label: 'Moderately Active', desc: 'Moderate exercise 3-4x/week' },
  very_active: { label: 'Very Active', desc: 'Hard exercise 5-6x/week' },
  extremely_active: { label: 'Extremely Active', desc: 'Very hard exercise, physical job' },
};

export function DietGoalQuestionnaire({
  initialStats,
  inferredActivity,
  existingProfile,
  onComplete,
}: DietGoalQuestionnaireProps) {
  const [step, setStep] = useState(1);

  // Step 1: Body Stats
  const [weight, setWeight] = useState<number>(existingProfile?.weight ?? initialStats?.weight ?? 0);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(existingProfile?.weightUnit ?? initialStats?.weightUnit ?? 'kg');
  const [height, setHeight] = useState<number>(existingProfile?.height ?? initialStats?.height ?? 0);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(existingProfile?.heightUnit ?? initialStats?.heightUnit ?? 'cm');
  const [age, setAge] = useState<number>(existingProfile?.age ?? initialStats?.age ?? 0);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(
    (existingProfile?.gender ?? initialStats?.gender as 'male' | 'female' | 'other') || 'male'
  );
  const [bodyFatPercent, setBodyFatPercent] = useState<number | undefined>(existingProfile?.bodyFatPercent);

  // Step 2: Activity
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    existingProfile?.activityLevel ?? inferredActivity?.activityLevel ??
    (inferredActivity?.trainingDaysPerWeek ? inferActivityFromDays(inferredActivity.trainingDaysPerWeek) : 'moderately_active')
  );
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number>(
    existingProfile?.trainingDaysPerWeek ?? inferredActivity?.trainingDaysPerWeek ?? 4
  );

  // Step 3: Goal
  const [dietGoal, setDietGoal] = useState<DietGoal | null>(existingProfile?.dietGoal ?? null);

  // Step 4: Style + preferences
  const [dietStyle, setDietStyle] = useState<DietStyle>(existingProfile?.dietStyle ?? 'flexible');
  const [allergies, setAllergies] = useState(existingProfile?.allergies ?? '');
  const [foodPreferences, setFoodPreferences] = useState(existingProfile?.foodPreferences ?? '');
  const [mealsPerDay, setMealsPerDay] = useState<number>(existingProfile?.mealsPerDay ?? 3);

  // Computed targets (for review step)
  const [computedTargets, setComputedTargets] = useState<{
    tdee: number;
    targets: DailyTargets;
    proteinPerKg: number;
    targetCalories: number;
  } | null>(null);

  const hasPrefilledStats = !!(initialStats?.weight || initialStats?.height || initialStats?.age);

  const canAdvance = useCallback((): boolean => {
    switch (step) {
      case 1: return weight > 0 && height > 0 && age > 0;
      case 2: return true;
      case 3: return dietGoal !== null;
      case 4: return true;
      case 5: return computedTargets !== null;
      default: return false;
    }
  }, [step, weight, height, age, dietGoal, computedTargets]);

  const computeTargets = useCallback(() => {
    if (!dietGoal) return null;
    const weightKg = toKg(weight, weightUnit);
    const heightCm = toCm(height, heightUnit);
    const tdee = calculateTDEE(weightKg, heightCm, age, gender, activityLevel);
    const targets = calculateMacroTargets(tdee, dietGoal, dietStyle, weightKg);

    // Extract proteinPerKg from the targets
    const proteinPerKg = Math.round((targets.protein / weightKg) * 10) / 10;

    return { tdee, targets, proteinPerKg, targetCalories: targets.calories };
  }, [weight, weightUnit, height, heightUnit, age, gender, activityLevel, dietGoal, dietStyle]);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      // When entering review, compute targets
      if (step === 4) {
        const computed = computeTargets();
        setComputedTargets(computed);
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSave = () => {
    if (!computedTargets || !dietGoal) return;

    const now = new Date().toISOString();
    const profile: DietGoalProfile = {
      weight,
      weightUnit,
      height,
      heightUnit,
      age,
      gender,
      bodyFatPercent: bodyFatPercent || undefined,
      activityLevel,
      trainingDaysPerWeek,
      dietGoal,
      dietStyle,
      tdee: computedTargets.tdee,
      targets: computedTargets.targets,
      proteinPerKg: computedTargets.proteinPerKg,
      allergies: allergies.trim() || undefined,
      foodPreferences: foodPreferences.trim() || undefined,
      mealsPerDay,
      createdAt: now,
      updatedAt: now,
    };

    onComplete(profile);
  };

  // Goal-specific calorie adjustment label
  const getGoalCalLabel = (goal: DietGoal, tdee: number, targetCal: number) => {
    const diff = targetCal - tdee;
    if (diff < 0) return `Deficit: ${diff} cal`;
    if (diff > 0) return `Surplus: +${diff} cal`;
    return 'Maintenance';
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--color-line)]">
        <div
          className="h-full bg-[var(--color-lime)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-line)]">
        {step > 1 && (
          <button onClick={handleBack} className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs text-[var(--color-muted)]">
          Step {step} of {TOTAL_STEPS}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Step 1: Body Stats */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-1">Body Stats</h2>
              {hasPrefilledStats && (
                <p className="text-xs text-[var(--color-lime)]/70 mb-3">
                  Pre-filled from your profile — edit if needed
                </p>
              )}
            </div>

            {/* Weight */}
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1.5 block">Weight</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={weight || ''}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  placeholder={weightUnit === 'kg' ? '80' : '176'}
                  className="flex-1 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
                />
                <div className="flex">
                  <button
                    onClick={() => setWeightUnit('kg')}
                    className={`px-3 py-2 text-xs border transition-colors ${weightUnit === 'kg' ? selectedStyle : unselectedStyle}`}
                  >
                    kg
                  </button>
                  <button
                    onClick={() => setWeightUnit('lbs')}
                    className={`px-3 py-2 text-xs border border-l-0 transition-colors ${weightUnit === 'lbs' ? selectedStyle : unselectedStyle}`}
                  >
                    lbs
                  </button>
                </div>
              </div>
            </div>

            {/* Height */}
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1.5 block">Height</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={height || ''}
                  onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                  placeholder={heightUnit === 'cm' ? '180' : '5.11'}
                  className="flex-1 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
                />
                <div className="flex">
                  <button
                    onClick={() => setHeightUnit('cm')}
                    className={`px-3 py-2 text-xs border transition-colors ${heightUnit === 'cm' ? selectedStyle : unselectedStyle}`}
                  >
                    cm
                  </button>
                  <button
                    onClick={() => setHeightUnit('ft')}
                    className={`px-3 py-2 text-xs border border-l-0 transition-colors ${heightUnit === 'ft' ? selectedStyle : unselectedStyle}`}
                  >
                    ft
                  </button>
                </div>
              </div>
            </div>

            {/* Age */}
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1.5 block">Age</label>
              <input
                type="number"
                value={age || ''}
                onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                placeholder="25"
                className="w-24 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1.5 block">Gender</label>
              <div className="flex gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 px-3 py-2 text-sm border transition-colors ${gender === g ? selectedStyle : unselectedStyle}`}
                  >
                    {formatLabel(g)}
                  </button>
                ))}
              </div>
            </div>

            {/* Body Fat % (optional) */}
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1.5 block">Body Fat % <span className="text-[var(--color-muted)]/50">(optional)</span></label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={bodyFatPercent ?? ''}
                  onChange={(e) => setBodyFatPercent(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="15"
                  className="w-24 px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
                />
                <span className="text-xs text-[var(--color-muted)]">%</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Activity Level */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-1">Activity Level</h2>
              {inferredActivity?.trainingDaysPerWeek && (
                <p className="text-xs text-[var(--color-lime)]/70 mb-3">
                  You train ~{inferredActivity.trainingDaysPerWeek}x/week based on gym data
                </p>
              )}
            </div>

            {/* Activity level cards */}
            <div className="space-y-2">
              {(Object.entries(activityInfo) as [ActivityLevel, { label: string; desc: string }][]).map(([value, info]) => (
                <button
                  key={value}
                  onClick={() => setActivityLevel(value)}
                  className={`w-full px-3 py-2.5 text-left border transition-colors ${activityLevel === value ? selectedStyle : unselectedStyle}`}
                >
                  <div className="text-sm">{info.label}</div>
                  <div className="text-[11px] opacity-60 mt-0.5">{info.desc}</div>
                </button>
              ))}
            </div>

            {/* Training days */}
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-2 block">Training days per week</label>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTrainingDaysPerWeek(d)}
                    className={`w-10 h-10 text-sm border transition-colors flex items-center justify-center ${
                      trainingDaysPerWeek === d ? selectedStyle : unselectedStyle
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Diet Goal */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">What&apos;s your goal?</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(goalInfo) as [DietGoal, { label: string; desc: string }][]).map(([value, info]) => (
                <button
                  key={value}
                  onClick={() => setDietGoal(value)}
                  className={`px-3 py-3 text-left border transition-colors ${dietGoal === value ? selectedStyle : unselectedStyle}`}
                >
                  <div className="text-sm">{info.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{info.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Diet Style + Preferences */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Diet style</h2>
              <div className="space-y-2">
                {(Object.entries(styleInfo) as [DietStyle, { label: string; desc: string }][]).map(([value, info]) => (
                  <button
                    key={value}
                    onClick={() => setDietStyle(value)}
                    className={`w-full px-3 py-2.5 text-left border transition-colors ${dietStyle === value ? selectedStyle : unselectedStyle}`}
                  >
                    <div className="text-sm">{info.label}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{info.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--color-muted)] mb-2 block">Meals per day</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMealsPerDay(n)}
                    className={`w-10 h-10 text-sm border transition-colors flex items-center justify-center ${
                      mealsPerDay === n ? selectedStyle : unselectedStyle
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1.5 block">Allergies / restrictions <span className="text-[var(--color-muted)]/50">(optional)</span></label>
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Lactose intolerant, no shellfish..."
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 resize-none text-[var(--color-text)]"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1.5 block">Food preferences <span className="text-[var(--color-muted)]/50">(optional)</span></label>
              <textarea
                value={foodPreferences}
                onChange={(e) => setFoodPreferences(e.target.value)}
                placeholder="Vegetarian, prefer Indian food..."
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 resize-none text-[var(--color-text)]"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 5: Review + Computed Targets */}
        {step === 5 && computedTargets && dietGoal && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-[var(--color-text)]">Your Computed Targets</h2>

            {/* TDEE breakdown */}
            <div className="p-3 border border-[var(--color-line)] bg-[var(--color-surface)]">
              <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-2">TDEE Estimate</div>
              <div className="text-2xl font-medium text-[var(--color-text)]">{computedTargets.tdee} <span className="text-sm text-[var(--color-muted)]">cal/day</span></div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                {toKg(weight, weightUnit).toFixed(1)}kg · {toCm(height, heightUnit).toFixed(0)}cm · {age}y · {formatLabel(gender)} · {formatLabel(activityLevel)}
              </div>
            </div>

            {/* Goal adjustment */}
            <div className="p-3 border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/5">
              <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-2">Daily Target</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-medium text-[var(--color-lime)]">{computedTargets.targetCalories}</span>
                <span className="text-sm text-[var(--color-muted)]">cal/day</span>
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                {formatLabel(dietGoal)} · {getGoalCalLabel(dietGoal, computedTargets.tdee, computedTargets.targetCalories)}
              </div>
            </div>

            {/* Macro breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 border border-[var(--color-line)] text-center">
                <div className="text-[10px] text-[var(--color-muted)] uppercase">Protein</div>
                <div className="text-lg font-medium text-[var(--color-text)]">{computedTargets.targets.protein}g</div>
                <div className="text-[10px] text-[var(--color-muted)]">{computedTargets.proteinPerKg}g/kg</div>
              </div>
              <div className="p-3 border border-[var(--color-line)] text-center">
                <div className="text-[10px] text-[var(--color-muted)] uppercase">Carbs</div>
                <div className="text-lg font-medium text-[var(--color-text)]">{computedTargets.targets.carbs}g</div>
                <div className="text-[10px] text-[var(--color-muted)]">{Math.round(computedTargets.targets.carbs * 4 / computedTargets.targetCalories * 100)}%</div>
              </div>
              <div className="p-3 border border-[var(--color-line)] text-center">
                <div className="text-[10px] text-[var(--color-muted)] uppercase">Fat</div>
                <div className="text-lg font-medium text-[var(--color-text)]">{computedTargets.targets.fat}g</div>
                <div className="text-[10px] text-[var(--color-muted)]">{Math.round(computedTargets.targets.fat * 9 / computedTargets.targetCalories * 100)}%</div>
              </div>
            </div>

            {/* Editable review sections */}
            <div className="space-y-2 mt-2">
              <button onClick={() => setStep(1)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Body Stats</span>
                <div className="text-sm text-[var(--color-text)]">{weight}{weightUnit} · {height}{heightUnit} · {age}y · {formatLabel(gender)}{bodyFatPercent ? ` · ${bodyFatPercent}% bf` : ''}</div>
              </button>

              <button onClick={() => setStep(2)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Activity</span>
                <div className="text-sm text-[var(--color-text)]">{formatLabel(activityLevel)} · {trainingDaysPerWeek} days/wk</div>
              </button>

              <button onClick={() => setStep(3)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Goal</span>
                <div className="text-sm text-[var(--color-text)]">{goalInfo[dietGoal].label}</div>
              </button>

              <button onClick={() => setStep(4)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Style</span>
                <div className="text-sm text-[var(--color-text)]">{styleInfo[dietStyle].label} · {mealsPerDay} meals/day</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="px-4 py-3 border-t border-[var(--color-line)]">
        {step < 5 ? (
          <button
            onClick={handleNext}
            disabled={!canAdvance()}
            className="w-full py-2.5 text-sm font-medium bg-[var(--color-text)] text-[var(--color-bg)] disabled:opacity-30 transition-opacity"
          >
            {step === 4 ? 'Review Targets' : 'Next'}
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="w-full py-2.5 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] flex items-center justify-center gap-2 transition-opacity"
          >
            Save Goals
          </button>
        )}
      </div>
    </div>
  );
}
