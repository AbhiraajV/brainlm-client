'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import type {
  TrainingGoal, ExperienceLevel, EquipmentAccess, SplitType,
  CardioLevel, SessionDuration, MuscleGroup, WorkoutPreferences,
} from '@/lib/sessions/types';

interface WorkoutQuestionnaireProps {
  onComplete: (preferences: WorkoutPreferences) => void;
  isGenerating?: boolean;
}

const TOTAL_STEPS = 6; // 5 input steps + 1 review

// Muscle group colors for chips (from TemplateExerciseRow)
const muscleGroupColors: Record<MuscleGroup, string> = {
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

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Recommend split based on goal + days
function recommendSplit(goal: TrainingGoal, days: number): SplitType {
  if (days <= 3) return 'full_body';
  if (days === 4) {
    if (goal === 'strength') return 'upper_lower';
    return 'upper_lower';
  }
  if (days === 5) return 'ppl';
  return 'ppl';
}

export function WorkoutQuestionnaire({ onComplete, isGenerating }: WorkoutQuestionnaireProps) {
  const [step, setStep] = useState(1);

  // Step 1
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);

  // Step 2
  const [equipmentAccess, setEquipmentAccess] = useState<EquipmentAccess | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>(60);

  // Step 3
  const [focusAreas, setFocusAreas] = useState<MuscleGroup[]>([]);
  const [deprioritizeAreas, setDeprioritizeAreas] = useState<MuscleGroup[]>([]);

  // Step 4
  const [splitType, setSplitType] = useState<SplitType | null>(null);
  const [cardioLevel, setCardioLevel] = useState<CardioLevel>('light');

  // Step 5
  const [injuries, setInjuries] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const canAdvance = useCallback((): boolean => {
    switch (step) {
      case 1: return trainingGoal !== null && experienceLevel !== null;
      case 2: return equipmentAccess !== null;
      case 3: return true; // optional
      case 4: return splitType !== null;
      case 5: return true; // optional
      case 6: return true; // review
      default: return false;
    }
  }, [step, trainingGoal, experienceLevel, equipmentAccess, splitType]);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      // Auto-recommend split when entering step 4
      if (step === 3 && !splitType && trainingGoal) {
        setSplitType(recommendSplit(trainingGoal, daysPerWeek));
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleGenerate = () => {
    if (!trainingGoal || !experienceLevel || !equipmentAccess || !splitType) return;
    onComplete({
      trainingGoal,
      experienceLevel,
      equipmentAccess,
      daysPerWeek,
      sessionDuration,
      focusAreas,
      deprioritizeAreas,
      splitType,
      cardioLevel,
      injuries: injuries.trim() || undefined,
      additionalNotes: additionalNotes.trim() || undefined,
    });
  };

  const toggleMuscle = (group: MuscleGroup, list: MuscleGroup[], setList: (v: MuscleGroup[]) => void, otherList: MuscleGroup[]) => {
    if (otherList.includes(group)) return; // can't be in both
    setList(list.includes(group) ? list.filter((g) => g !== group) : [...list, group]);
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
          Step {Math.min(step, 5)} of 5
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Step 1: Goal & Experience */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">What&apos;s your goal?</h2>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['weight_loss', 'Weight Loss'],
                  ['muscle_gain', 'Muscle Gain'],
                  ['strength', 'Strength'],
                  ['general_fitness', 'General Fitness'],
                  ['endurance', 'Endurance'],
                  ['body_recomp', 'Body Recomp'],
                ] as [TrainingGoal, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTrainingGoal(value)}
                    className={`px-3 py-3 text-sm border transition-colors ${
                      trainingGoal === value
                        ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                        : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Experience level</h2>
              <div className="flex gap-2">
                {([
                  ['beginner', 'Beginner'],
                  ['intermediate', 'Intermediate'],
                  ['advanced', 'Advanced'],
                ] as [ExperienceLevel, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setExperienceLevel(value)}
                    className={`flex-1 px-3 py-2 text-sm border transition-colors ${
                      experienceLevel === value
                        ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                        : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Equipment & Schedule */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Equipment access</h2>
              <div className="space-y-2">
                {([
                  ['full_gym', 'Full Gym'],
                  ['home_gym', 'Home Gym'],
                  ['dumbbells_only', 'Dumbbells Only'],
                  ['bodyweight', 'Bodyweight'],
                  ['minimal', 'Minimal'],
                ] as [EquipmentAccess, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setEquipmentAccess(value)}
                    className={`w-full px-3 py-2.5 text-sm text-left border transition-colors ${
                      equipmentAccess === value
                        ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                        : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Days per week</h2>
              <div className="flex gap-2">
                {[3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDaysPerWeek(d)}
                    className={`flex-1 px-3 py-2 text-sm border transition-colors ${
                      daysPerWeek === d
                        ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                        : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Session duration</h2>
              <div className="flex gap-2">
                {([30, 45, 60, 90] as SessionDuration[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSessionDuration(d)}
                    className={`flex-1 px-3 py-2 text-sm border transition-colors ${
                      sessionDuration === d
                        ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                        : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Focus Areas */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-1">Emphasize</h2>
              <p className="text-xs text-[var(--color-muted)] mb-3">Optional — select muscles to prioritize</p>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((mg) => {
                  const isSelected = focusAreas.includes(mg);
                  const isDisabled = deprioritizeAreas.includes(mg);
                  return (
                    <button
                      key={mg}
                      onClick={() => toggleMuscle(mg, focusAreas, setFocusAreas, deprioritizeAreas)}
                      disabled={isDisabled}
                      className={`px-2 py-1 text-[11px] border transition-colors ${
                        isSelected
                          ? muscleGroupColors[mg]
                          : isDisabled
                          ? 'border-[var(--color-line)] text-[var(--color-muted)]/30 opacity-40'
                          : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                      }`}
                    >
                      {formatLabel(mg)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-1">Deprioritize</h2>
              <p className="text-xs text-[var(--color-muted)] mb-3">Optional — select muscles to de-emphasize</p>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((mg) => {
                  const isSelected = deprioritizeAreas.includes(mg);
                  const isDisabled = focusAreas.includes(mg);
                  return (
                    <button
                      key={mg}
                      onClick={() => toggleMuscle(mg, deprioritizeAreas, setDeprioritizeAreas, focusAreas)}
                      disabled={isDisabled}
                      className={`px-2 py-1 text-[11px] border transition-colors ${
                        isSelected
                          ? 'border-[var(--color-muted)] bg-[var(--color-muted)]/10 text-[var(--color-muted)]'
                          : isDisabled
                          ? 'border-[var(--color-line)] text-[var(--color-muted)]/30 opacity-40'
                          : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                      }`}
                    >
                      {formatLabel(mg)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Split & Cardio */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Split type</h2>
              <div className="space-y-2">
                {([
                  ['ppl', 'Push / Pull / Legs'],
                  ['upper_lower', 'Upper / Lower'],
                  ['full_body', 'Full Body'],
                  ['bro_split', 'Bro Split'],
                  ['push_pull', 'Push / Pull'],
                ] as [SplitType, string][]).map(([value, label]) => {
                  const isRecommended = trainingGoal ? recommendSplit(trainingGoal, daysPerWeek) === value : false;
                  return (
                    <button
                      key={value}
                      onClick={() => setSplitType(value)}
                      className={`w-full px-3 py-2.5 text-sm text-left border transition-colors flex items-center justify-between ${
                        splitType === value
                          ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                          : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                      }`}
                    >
                      <span>{label}</span>
                      {isRecommended && (
                        <span className="text-[10px] text-[var(--color-lime)]/70">Recommended</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Cardio</h2>
              <div className="space-y-2">
                {([
                  ['none', 'None'],
                  ['light', 'Light — warmup only'],
                  ['moderate', 'Moderate — end of session'],
                  ['heavy', 'Heavy — dedicated days'],
                ] as [CardioLevel, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setCardioLevel(value)}
                    className={`w-full px-3 py-2.5 text-sm text-left border transition-colors ${
                      cardioLevel === value
                        ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                        : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Final Details */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-1">Injuries or limitations</h2>
              <p className="text-xs text-[var(--color-muted)] mb-3">Optional</p>
              <textarea
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
                placeholder="Dodgy left shoulder, bad knees..."
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 resize-none"
                rows={3}
              />
            </div>

            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)] mb-1">Anything else?</h2>
              <p className="text-xs text-[var(--color-muted)] mb-3">Optional</p>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="I prefer supersets, hate leg press..."
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-[var(--color-text)]">Review</h2>

            <button onClick={() => setStep(1)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
              <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Goal</span>
              <div className="text-sm text-[var(--color-text)]">{formatLabel(trainingGoal || '')}</div>
            </button>

            <button onClick={() => setStep(1)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
              <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Experience</span>
              <div className="text-sm text-[var(--color-text)]">{formatLabel(experienceLevel || '')}</div>
            </button>

            <button onClick={() => setStep(2)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
              <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Equipment & Schedule</span>
              <div className="text-sm text-[var(--color-text)]">
                {formatLabel(equipmentAccess || '')} · {daysPerWeek} days/wk · {sessionDuration}min
              </div>
            </button>

            {focusAreas.length > 0 && (
              <button onClick={() => setStep(3)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Focus</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {focusAreas.map((mg) => (
                    <span key={mg} className={`text-[10px] px-1.5 py-0.5 border ${muscleGroupColors[mg]}`}>
                      {formatLabel(mg)}
                    </span>
                  ))}
                </div>
              </button>
            )}

            <button onClick={() => setStep(4)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
              <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Split & Cardio</span>
              <div className="text-sm text-[var(--color-text)]">
                {formatLabel(splitType || '')} · {formatLabel(cardioLevel)} cardio
              </div>
            </button>

            {(injuries || additionalNotes) && (
              <button onClick={() => setStep(5)} className="w-full text-left px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-muted)] transition-colors">
                <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Notes</span>
                {injuries && <div className="text-xs text-[var(--color-muted)] mt-0.5">{injuries}</div>}
                {additionalNotes && <div className="text-xs text-[var(--color-muted)] mt-0.5">{additionalNotes}</div>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="px-4 py-3 border-t border-[var(--color-line)]">
        {step < 6 ? (
          <button
            onClick={handleNext}
            disabled={!canAdvance()}
            className="w-full py-2.5 text-sm font-medium bg-[var(--color-text)] text-[var(--color-bg)] disabled:opacity-30 transition-opacity"
          >
            {step === 5 ? 'Review' : 'Next'}
          </button>
        ) : (
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
