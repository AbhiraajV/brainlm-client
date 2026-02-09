'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, Dumbbell, Sparkles } from 'lucide-react';
import { formatMuscleGroup, getMuscleGroupColor } from '@/lib/gym/muscle-groups';
import { generateQuickWorkout } from '@/server/actions/template-suggestion.actions';
import { useExercisesStore } from '@/store/exercises.store';
import { getExerciseTargetsForDay } from '@/server/actions/gym-history.actions';
import type { WorkoutLog, ExerciseEntry, MuscleGroup, EquipmentAccess } from '@/lib/sessions/types';
import type { GeneratedExercise } from '@/server/agents/template-coach-tools';

interface QuickAIPanelProps {
  onWorkoutGenerated: (log: WorkoutLog) => void;
  onBack: () => void;
}

const DURATION_OPTIONS = [30, 45, 60, 90] as const;

const MUSCLE_OPTIONS: { value: MuscleGroup; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'quadriceps', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'abs', label: 'Core' },
  { value: 'traps', label: 'Traps' },
  { value: 'lats', label: 'Lats' },
  { value: 'full_body', label: 'Full Body' },
];

const EQUIPMENT_OPTIONS: { value: EquipmentAccess; label: string }[] = [
  { value: 'full_gym', label: 'Full Gym' },
  { value: 'home_gym', label: 'Home' },
  { value: 'dumbbells_only', label: 'Dumbbells' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

export function QuickAIPanel({ onWorkoutGenerated, onBack }: QuickAIPanelProps) {
  const [duration, setDuration] = useState<number>(60);
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<EquipmentAccess>('full_gym');
  const [showEquipment, setShowEquipment] = useState(false);
  const [instructions, setInstructions] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedExercise[] | null>(null);
  const [workoutName, setWorkoutName] = useState('');

  // Prevent stale state updates if user navigates away
  const mountedRef = useRef(true);

  const toggleMuscle = useCallback((muscle: MuscleGroup) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedMuscles.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateQuickWorkout(
        selectedMuscles,
        duration,
        equipment,
        instructions.trim() || undefined,
      );

      if (!mountedRef.current) return;

      if (result.error || !result.exercises) {
        setError(result.error || 'Failed to generate workout. Try again.');
        return;
      }

      setPreview(result.exercises);
      setWorkoutName(result.workoutName);
    } catch (err) {
      if (!mountedRef.current) return;
      setError('Something went wrong. Try again.');
      console.error('[QuickAIPanel] Generate error:', err);
    } finally {
      if (mountedRef.current) setIsGenerating(false);
    }
  }, [selectedMuscles, duration, equipment, instructions, isGenerating]);

  const handleStartWorkout = useCallback(async () => {
    if (!preview) return;
    setIsGenerating(true);

    try {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const registry = useExercisesStore.getState();

      // Convert generated exercises to ExerciseEntry[]
      // Exercises are already resolved against the global DB by the server action
      const exercises: ExerciseEntry[] = preview.map((ex, index) => {
        // Resolve through exercise registry for stable local IDs
        const def = registry.resolveExercise(ex.exerciseName, ex.muscleGroup, ex.equipmentType);

        return {
          id: crypto.randomUUID(),
          exerciseName: ex.exerciseName,
          exerciseRegistryId: def.id,
          globalExerciseId: ex.globalExerciseId,
          muscleGroup: ex.muscleGroup,
          secondaryMuscles: ex.secondaryMuscles,
          equipmentType: ex.equipmentType,
          sets: [],
          notes: ex.notes,
          orderIndex: index,
          targets: {
            weight: ex.targetWeight || 0,
            weightUnit: ex.targetWeightUnit || 'kg',
            reps: ex.targetReps,
            sets: ex.targetSets,
            rationale: 'AI-generated quick workout',
            confidence: 'medium' as const,
            source: 'estimation' as const,
          },
        };
      });

      // Fetch progressive overload targets
      try {
        const targets = await getExerciseTargetsForDay(
          exercises.map((ex) => ({
            name: ex.exerciseName,
            registryId: ex.exerciseRegistryId,
          })),
        );

        for (const ex of exercises) {
          const target = targets.find(
            (t) => t.exerciseName.toLowerCase() === ex.exerciseName.toLowerCase(),
          );
          if (!target?.suggestedTargets || !ex.targets) continue;

          ex.targets = {
            ...ex.targets,
            weight: target.suggestedTargets.weight,
            weightUnit: target.suggestedTargets.weightUnit,
            reps: target.suggestedTargets.reps,
            sets: target.suggestedTargets.sets,
            rationale: target.suggestedTargets.rationale,
            confidence: target.suggestedTargets.confidence,
            source: target.suggestedTargets.source as 'history' | 'correlation' | 'estimation',
          };

          if (target.lastSession) {
            ex.computed = {
              totalVolume: 0,
              totalReps: 0,
              bestE1RM: 0,
              lastSession: {
                date: target.lastSession.date,
                topSet: target.lastSession.sets.reduce(
                  (best, s) => (s.weight > best.weight ? s : best),
                  target.lastSession.sets[0] || { weight: 0, reps: 0 },
                ),
              },
            };
          }
        }
      } catch {
        // Targets are nice-to-have; proceed without them
      }

      const muscleGroups = [...new Set(exercises.map((e) => e.muscleGroup))] as MuscleGroup[];

      const workoutLog: WorkoutLog = {
        id: crypto.randomUUID(),
        date: today,
        workoutName,
        muscleGroups,
        exercises,
        summary: {
          totalExercises: exercises.length,
          totalSets: 0,
          totalReps: 0,
          totalVolume: 0,
          totalVolumeUnit: 'lbs',
          muscleGroupsWorked: muscleGroups,
          prCount: 0,
        },
        preferredUnit: 'lbs',
        createdAt: now,
        updatedAt: now,
      };

      if (mountedRef.current) {
        onWorkoutGenerated(workoutLog);
      }
    } catch (err) {
      console.error('[QuickAIPanel] Start error:', err);
      if (mountedRef.current) setError('Failed to start workout.');
    } finally {
      if (mountedRef.current) setIsGenerating(false);
    }
  }, [preview, workoutName, onWorkoutGenerated]);

  // Preview mode: show generated exercises
  if (preview) {
    return (
      <div className="min-h-full flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-7 pt-6 pb-4 flex items-center gap-3">
          <button
            onClick={() => { setPreview(null); setError(null); }}
            className="p-1 -ml-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="font-serif text-xl text-[var(--color-text)]">{workoutName}</p>
            <p className="text-xs text-[var(--color-muted)]">
              {preview.length} exercises &middot; ~{duration}min
            </p>
          </div>
        </div>

        {/* Exercise list */}
        <div className="flex-1 px-5 sm:px-7 space-y-2 pb-4">
          {preview.map((ex, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-line)] rounded"
            >
              <span className="text-xs text-[var(--color-muted)] w-5 text-center font-medium">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text)] truncate">{ex.exerciseName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--color-muted)]">
                    {ex.targetSets} &times; {ex.targetReps}
                  </span>
                  <span className={`text-[9px] px-1 py-0.5 font-medium rounded ${getMuscleGroupColor(ex.muscleGroup)}`}>
                    {formatMuscleGroup(ex.muscleGroup)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Start button */}
        <div className="px-5 sm:px-7 pb-8 pt-2">
          <button
            onClick={handleStartWorkout}
            disabled={isGenerating}
            className="w-full py-3 bg-[var(--color-lime)] text-[var(--color-bg)] font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Dumbbell className="w-4 h-4" />
                Start Workout
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Selection mode: muscle groups, duration, equipment, instructions
  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="px-5 sm:px-7 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="font-serif text-xl text-[var(--color-text)]">Quick AI Workout</p>
          <p className="text-xs text-[var(--color-muted)]">Pick muscles and duration</p>
        </div>
      </div>

      <div className="flex-1 px-5 sm:px-7 space-y-6 pb-8">
        {/* Muscle Groups */}
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-2 block">
            Target Muscles
          </label>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_OPTIONS.map((opt) => {
              const isSelected = selectedMuscles.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleMuscle(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    isSelected
                      ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                      : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-2 block">
            Duration
          </label>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex-1 py-2 text-sm rounded border transition-all ${
                  duration === d
                    ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                    : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Equipment (collapsible) */}
        <div>
          <button
            onClick={() => setShowEquipment(!showEquipment)}
            className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-2 flex items-center gap-1 hover:text-[var(--color-text)]"
          >
            Equipment
            <span className="text-[9px] normal-case">
              {showEquipment ? '(hide)' : `(${EQUIPMENT_OPTIONS.find(e => e.value === equipment)?.label || 'Full Gym'})`}
            </span>
          </button>
          {showEquipment && (
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEquipment(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    equipment === opt.value
                      ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                      : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-2 block">
            Anything else? <span className="normal-case text-[var(--color-muted)]/60">(optional)</span>
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Include bench press and cable flies, skip overhead press, I have a bad shoulder..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-line)] rounded text-[var(--color-text)] placeholder:text-[var(--color-muted)]/40 focus:outline-none focus:border-[var(--color-lime)] resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={selectedMuscles.length === 0 || isGenerating}
          className="w-full py-3 bg-[var(--color-lime)] text-[var(--color-bg)] font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Building your workout...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Workout
            </>
          )}
        </button>
      </div>
    </div>
  );
}
