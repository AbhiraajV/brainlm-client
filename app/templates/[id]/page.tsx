'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, Star, StarOff, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useTemplatesStore, usePlan } from '@/store/templates.store';
import { useHydrated } from '@/hooks/useHydrated';
import { PreferencesSummary, GeneratePromptArea, EXERCISE_GENERATION_CHIPS } from '@/components/templates';
import { BackButton } from '@/components/ui/BackButton';
// import { MuscleFrequencyBar } from '@/components/templates';
// import { computeMuscleFrequency } from '@/lib/templates/utils';
import { generateAllDayExercises } from '@/server/actions/template-suggestion.actions';
import type { TemplateExercise } from '@/lib/sessions/types';
import { getMuscleGroupColor, formatMuscleGroup } from '@/lib/gym/muscle-groups';

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

export default function PlanOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const router = useRouter();

  const plan = usePlan(id);
  const updatePlan = useTemplatesStore((s) => s.updatePlan);
  const setPlanDayExercises = useTemplatesStore((s) => s.setPlanDayExercises);
  const activePlanId = useTemplatesStore((s) => s.activePlanId);
  const setActivePlan = useTemplatesStore((s) => s.setActivePlan);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [generateAllInstruction, setGenerateAllInstruction] = useState('');
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState(0);
  const [generateAllTotal, setGenerateAllTotal] = useState(0);

  // --- Commented out: Edit Plan ---
  // const [editInstruction, setEditInstruction] = useState('');
  // const [isEditingPlan, setIsEditingPlan] = useState(false);
  // const [editError, setEditError] = useState<string | null>(null);

  const isActive = plan?.id === activePlanId;

  // --- Commented out: Muscle frequency ---
  // const frequency = useMemo(
  //   () => (plan ? computeMuscleFrequency(plan.days) : {}),
  //   [plan]
  // );

  const handleSaveName = () => {
    if (editedName.trim() && plan) {
      updatePlan(id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  // --- Commented out: Edit Plan handler ---
  // const handleEditPlan = async () => {
  //   if (!plan || !editInstruction.trim() || isEditingPlan) return;
  //   setIsEditingPlan(true);
  //   setEditError(null);
  //   try {
  //     const { editWorkoutPlan } = await import('@/server/actions/template-suggestion.actions');
  //     const result = await editWorkoutPlan(
  //       {
  //         name: plan.name,
  //         description: plan.description,
  //         splitType: plan.preferences.splitType,
  //         days: plan.days.map((d) => ({
  //           dayLabel: d.dayLabel,
  //           name: d.name,
  //           description: d.description,
  //           targetMuscles: d.targetMuscles,
  //           estimatedDuration: d.estimatedDuration,
  //           isRestDay: d.isRestDay,
  //           isCardioDay: d.isCardioDay,
  //           cardioNotes: d.cardioNotes,
  //           exercises: d.exercises.map((e) => ({ exerciseName: e.exerciseName })),
  //         })),
  //       },
  //       plan.preferences,
  //       editInstruction.trim()
  //     );
  //     if (result.plan) {
  //       const newDays: PlanDay[] = result.plan.days.map((d, i) => ({
  //         id: generateId(),
  //         dayNumber: d.dayNumber,
  //         dayLabel: d.dayLabel,
  //         name: d.name,
  //         description: d.description,
  //         targetMuscles: d.targetMuscles,
  //         estimatedDuration: d.estimatedDuration,
  //         isRestDay: d.isRestDay,
  //         isCardioDay: d.isCardioDay,
  //         cardioNotes: d.cardioNotes,
  //         exercises: [],
  //         orderIndex: i,
  //       }));
  //       const trainingDayCount = newDays.filter((d) => !d.isRestDay).length;
  //       updatePlan(id, {
  //         name: result.plan.name,
  //         description: result.plan.description,
  //         days: newDays,
  //         preferences: {
  //           ...plan.preferences,
  //           splitType: result.plan.splitType,
  //           daysPerWeek: trainingDayCount,
  //         },
  //       });
  //       setEditInstruction('');
  //     } else {
  //       setEditError(result.error || 'Failed to edit plan');
  //     }
  //   } catch (err) {
  //     setEditError(err instanceof Error ? err.message : 'Failed to edit plan');
  //   } finally {
  //     setIsEditingPlan(false);
  //   }
  // };

  const handleGenerateAll = async () => {
    if (!plan || generatingAll) return;

    const trainingDays = plan.days.filter((d) => !d.isRestDay);
    const emptyCount = trainingDays.filter((d) => d.exercises.length === 0).length;
    const hasExisting = trainingDays.some((d) => d.exercises.length > 0);

    // If all days already have exercises, regenerate all (forceAll=true)
    // If some are empty, only fill the empty ones
    const forceAll = emptyCount === 0;
    const targetCount = forceAll ? trainingDays.length : emptyCount;

    if (targetCount === 0) return;

    setGeneratingAll(true);
    setGenerateAllProgress(0);
    setGenerateAllTotal(targetCount);

    try {
      const results = await generateAllDayExercises(
        plan.preferences,
        plan,
        generateAllInstruction.trim() || undefined,
        forceAll
      );

      for (const result of results) {
        const templateExercises: TemplateExercise[] = result.exercises.map((ex, index) => ({
          id: generateId(),
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          secondaryMuscles: ex.secondaryMuscles,
          equipmentType: ex.equipmentType,
          exerciseRegistryId: ex.exerciseRegistryId,
          globalExerciseId: ex.globalExerciseId,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          targetWeight: ex.targetWeight,
          targetWeightUnit: ex.targetWeightUnit || 'kg',
          restSeconds: ex.restSeconds,
          notes: ex.notes,
          orderIndex: index,
        }));

        setPlanDayExercises(id, result.dayId, templateExercises);
        setGenerateAllProgress((prev) => prev + 1);
      }

      setGenerateAllInstruction('');
    } catch (err) {
      console.error('[GenerateAll] Error:', err);
    } finally {
      setGeneratingAll(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Plan</div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Plan</div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-sm text-[var(--color-text)]">Plan not found</p>
          <button
            onClick={() => router.push('/templates')}
            className="mt-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Back to plans
          </button>
        </main>
        <BackButton />
      </div>
    );
  }

  const sortedDays = [...plan.days].sort((a, b) => a.orderIndex - b.orderIndex);
  const trainingDayCount = plan.days.filter((d) => !d.isRestDay).length;
  const emptyTrainingDayCount = plan.days.filter((d) => !d.isRestDay && d.exercises.length === 0).length;
  const allFilled = emptyTrainingDayCount === 0;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Compact header: title + stats + collapsible details */}
      <header className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-line)]">
        {/* Title row */}
        <div className="flex items-center gap-2 px-4 py-2.5">
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1 px-2 py-1 text-base font-bold bg-transparent border-b border-[var(--color-lime)] text-[var(--color-lime)] focus:outline-none"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <button onClick={handleSaveName} className="p-1 text-[var(--color-lime)]">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setDetailsOpen(!detailsOpen)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="text-base font-bold text-[var(--color-lime)] truncate">
                  {plan.name}
                </span>
                <span className="text-[11px] text-[var(--color-muted)] shrink-0">
                  {trainingDayCount}d
                </span>
                {detailsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                )}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setEditedName(plan.name); setIsEditingName(true); }}
                className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActivePlan(isActive ? null : plan.id); }}
                className={`p-1 transition-colors ${
                  isActive ? 'text-[var(--color-lime)]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {isActive ? <Star className="w-3.5 h-3.5 fill-current" /> : <StarOff className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>

        {/* Expandable details */}
        {detailsOpen && (
          <div className="border-t border-[var(--color-line)]">
            {plan.description && (
              <div className="px-4 py-2 text-xs text-[var(--color-muted)]">
                {plan.description}
              </div>
            )}
            <div className="px-4 pb-2 flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
              <span>{trainingDayCount} training</span>
              <span className="text-[var(--color-line)]">|</span>
              <span>{7 - trainingDayCount} rest</span>
              {plan.usageCount > 0 && (
                <>
                  <span className="text-[var(--color-line)]">|</span>
                  <span>{plan.usageCount}x used</span>
                </>
              )}
            </div>
            <PreferencesSummary preferences={plan.preferences} />
          </div>
        )}
      </header>

      <main className="flex-1">

        {/* --- Commented out: Muscle frequency --- */}
        {/* {Object.keys(frequency).length > 0 && (
          <MuscleFrequencyBar frequency={frequency} />
        )} */}

        {/* 7-day calendar grid (3 per row) */}
        <div className="grid grid-cols-3 gap-2 p-3">
          {sortedDays.map((day) => {
            const isRest = day.isRestDay;
            const hasExercises = day.exercises.length > 0;
            return (
              <button
                key={day.id}
                onClick={isRest ? undefined : () => router.push(`/templates/${id}/${day.id}`)}
                disabled={isRest}
                className={`flex flex-col items-start p-2.5 rounded border text-left transition-colors ${
                  isRest
                    ? 'border-[var(--color-line)]/50 opacity-40 cursor-default'
                    : 'border-[var(--color-line)] hover:border-[var(--color-lime)]/50 hover:bg-[var(--color-surface)]/50 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold text-[var(--color-lime)] uppercase">
                    {day.dayLabel}
                  </span>
                  {!isRest && (
                    <span className={`text-[9px] ${
                      hasExercises ? 'text-[var(--color-muted)]' : 'text-[var(--color-lime)]/70'
                    }`}>
                      {hasExercises ? `${day.exercises.length}ex` : '---'}
                    </span>
                  )}
                </div>
                <span className={`text-xs mt-0.5 truncate w-full ${
                  isRest ? 'text-[var(--color-muted)]' : 'text-[var(--color-text)] font-bold'
                }`}>
                  {isRest ? 'Rest' : day.name}
                </span>
                {!isRest && day.targetMuscles.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1.5 w-full">
                    {day.targetMuscles.slice(0, 2).map((mg) => (
                      <span
                        key={mg}
                        className={`text-[8px] px-1 py-px rounded-sm leading-tight ${getMuscleGroupColor(mg)}`}
                      >
                        {formatMuscleGroup(mg)}
                      </span>
                    ))}
                    {day.targetMuscles.length > 2 && (
                      <span className="text-[8px] text-[var(--color-muted)] px-0.5">
                        +{day.targetMuscles.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Generate / Regenerate Workouts section — always visible */}
        <div className="border-t border-[var(--color-line)]">
          <GeneratePromptArea
            title={allFilled ? 'Regenerate Workouts' : 'Fill Workouts'}
            subtitle={
              allFilled
                ? `${trainingDayCount} training days`
                : `${emptyTrainingDayCount} day${emptyTrainingDayCount > 1 ? 's' : ''} need exercises`
            }
            helperText={
              allFilled
                ? 'Describe your preferences and we\'ll regenerate exercises for all training days'
                : 'Describe your preferences and we\'ll generate exercises for all empty training days'
            }
            placeholder="e.g., Focus on compound movements, no machines, include supersets..."
            chips={EXERCISE_GENERATION_CHIPS}
            value={generateAllInstruction}
            onChange={setGenerateAllInstruction}
            onSubmit={handleGenerateAll}
            submitLabel={
              allFilled
                ? `Regenerate All Workouts (${trainingDayCount} days)`
                : `Generate All Workouts (${emptyTrainingDayCount} days)`
            }
            submitIcon={<Zap className="w-4 h-4" />}
            isLoading={generatingAll}
            loadingLabel={`Generating Day ${generateAllProgress + 1} of ${generateAllTotal}...`}
            variant={allFilled ? 'outline' : 'primary'}
          />
        </div>

        {/* --- Commented out: Edit Plan section ---
        <div className="border-t border-[var(--color-line)]">
          <GeneratePromptArea
            title="Edit Plan"
            subtitle="Restructure days or split"
            helperText="Describe changes to your plan structure. Exercises will be cleared for regeneration."
            placeholder="e.g., Change to upper/lower split, add a dedicated arm day..."
            chips={PLAN_EDIT_CHIPS}
            value={editInstruction}
            onChange={setEditInstruction}
            onSubmit={handleEditPlan}
            submitLabel="Edit Plan"
            submitIcon={<Send className="w-4 h-4" />}
            isLoading={isEditingPlan}
            loadingLabel="Editing plan..."
            error={editError}
            variant="outline"
          />
        </div>
        */}

        {/* Spacer */}
        <div className="h-20" />
      </main>

      <BackButton />
    </div>
  );
}
