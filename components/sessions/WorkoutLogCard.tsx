'use client';

import { useState, useCallback } from 'react';
import type { WorkoutLog, ExerciseEntry, WorkoutSet, MuscleGroup, EquipmentType, SetType, WeightUnit, ExerciseTargets } from '@/lib/sessions/types';
import { Dumbbell, Trophy, Target, Flame, Plus, X, Check, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { calculateE1RM } from '@/lib/gym/formulas';
import { TabBar } from '@/components/ui/TabBar';
import { getMuscleGroupColor, formatMuscleGroup as fmtMuscle, BROAD_MUSCLE_GROUPS } from '@/lib/gym/muscle-groups';

interface WorkoutLogCardProps {
  workoutLog: WorkoutLog | undefined;
  isLoading?: boolean;
  editable?: boolean;
  onUpdate?: (workout: WorkoutLog) => void;
}

// Muscle group options for select (broad groups only for manual add)
const muscleGroupOptions: MuscleGroup[] = BROAD_MUSCLE_GROUPS;

// Equipment type options
const equipmentOptions: EquipmentType[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'kettlebell', 'resistance_band', 'smith_machine', 'ez_bar', 'trap_bar', 'other'
];

// Set type options
const setTypeOptions: SetType[] = [
  'warmup', 'working', 'top', 'backoff', 'dropset', 'superset',
  'rest_pause', 'to_failure', 'forced_reps', 'myo_reps', 'cluster', 'amrap'
];

// Format muscle group for display (delegated to centralized util)
function formatMuscleGroup(mg: MuscleGroup | null | undefined): string {
  return fmtMuscle(mg);
}

// Format equipment type for display
function formatEquipmentType(et: EquipmentType | null | undefined): string {
  if (!et) return 'Other';
  return et.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format set type for display
function formatSetType(st: SetType | null | undefined): string {
  if (!st) return 'Working';
  return st.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get progress color based on actual vs target comparison
function getProgressColor(actual: number, target: number): string {
  if (target === 0) return 'text-[var(--color-text)]';
  const ratio = actual / target;
  if (ratio >= 1) return 'text-green-600';  // Met or exceeded
  if (ratio >= 0.9) return 'text-amber-600'; // Close (within 10%)
  return 'text-red-500';  // Below target
}

// Get progress icon based on actual vs target
function getProgressIcon(actual: number, target: number) {
  if (target === 0) return null;
  const ratio = actual / target;
  if (ratio >= 1) return <TrendingUp className="w-3 h-3 text-green-600" />;
  if (ratio >= 0.9) return <Minus className="w-3 h-3 text-amber-600" />;
  return <TrendingDown className="w-3 h-3 text-red-500" />;
}

// Confidence badge colors
function getConfidenceBadge(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high': return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
    case 'medium': return 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]';
    case 'low': return 'bg-[var(--color-line)] text-[var(--color-muted)]';
  }
}

// Inline editable set row - always shows input fields for direct editing
function InlineSetRow({
  set,
  editable,
  preferredUnit,
  onUpdate,
  onDelete,
}: {
  set: WorkoutSet;
  editable?: boolean;
  preferredUnit: WeightUnit;
  onUpdate?: (updatedSet: WorkoutSet) => void;
  onDelete?: () => void;
}) {
  const isPR = set.computed?.isPR || set.prFlags?.e1rmPR || set.prFlags?.weightPR;
  const isSpecial = set.setType !== 'working';

  // Local state for inline editing
  const [weight, setWeight] = useState(set.weight.toString());
  const [reps, setReps] = useState(set.actualReps.toString());
  const [rpe, setRpe] = useState(set.rpe?.toString() || '');

  // Commit changes on blur
  const handleBlur = useCallback(() => {
    const newWeight = parseFloat(weight) || 0;
    const newReps = parseInt(reps) || 0;
    const newRpe = rpe ? parseFloat(rpe) : undefined;

    // Only update if values changed
    if (newWeight !== set.weight || newReps !== set.actualReps || newRpe !== set.rpe) {
      onUpdate?.({
        ...set,
        weight: newWeight,
        actualReps: newReps,
        rpe: newRpe,
        computed: {
          volume: newWeight * newReps,
          e1rm: calculateE1RM(newWeight, newReps),
          isPR: set.computed?.isPR || false,
        }
      });
    }
  }, [weight, reps, rpe, set, onUpdate]);

  // PR indicator styles
  const rowBg = isPR ? 'bg-amber-50' : '';

  return (
    <div className={`flex items-center gap-2 py-1.5 px-1 rounded ${rowBg} group`}>
      {/* Set number */}
      <span className="w-5 text-xs text-[var(--color-muted)] font-medium">
        {set.setNumber}
      </span>

      {/* Weight input */}
      {editable ? (
        <input
          type="number"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onBlur={handleBlur}
          className="w-16 px-1.5 py-0.5 text-xs text-center border border-[var(--color-line)] rounded bg-transparent focus:border-[var(--color-accent)] focus:outline-none"
          placeholder={preferredUnit}
        />
      ) : (
        <span className="w-16 text-xs text-center font-medium">
          {set.weight === 0 ? 'BW' : set.weight}
        </span>
      )}

      <span className="text-[var(--color-muted)] text-xs">×</span>

      {/* Reps input */}
      {editable ? (
        <input
          type="number"
          value={reps}
          onChange={e => setReps(e.target.value)}
          onBlur={handleBlur}
          className="w-12 px-1.5 py-0.5 text-xs text-center border border-[var(--color-line)] rounded bg-transparent focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="reps"
        />
      ) : (
        <span className="w-12 text-xs text-center font-medium">{set.actualReps}</span>
      )}

      {/* RPE input (optional) */}
      {editable ? (
        <input
          type="number"
          value={rpe}
          onChange={e => setRpe(e.target.value)}
          onBlur={handleBlur}
          min="1"
          max="10"
          step="0.5"
          className="w-10 px-1 py-0.5 text-xs text-center border border-[var(--color-line)] rounded bg-transparent focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="RPE"
        />
      ) : set.rpe ? (
        <span className="w-10 text-xs text-center text-[var(--color-muted)]">@{set.rpe}</span>
      ) : (
        <span className="w-10" />
      )}

      {/* Set type badge */}
      {isSpecial && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent-light)] text-[var(--color-accent)]">
          {set.setType.replace(/_/g, ' ')}
        </span>
      )}

      {/* e1RM display */}
      {set.computed?.e1rm && set.computed.e1rm > 0 && (
        <span className="text-[10px] text-[var(--color-muted)] ml-auto">
          e1RM: {Math.round(set.computed.e1rm)}
        </span>
      )}

      {/* PR badge */}
      {isPR && (
        <span className="flex items-center gap-0.5 text-amber-600">
          <Trophy className="w-3 h-3" />
          <span className="text-[10px] font-medium">PR</span>
        </span>
      )}

      {/* Delete button */}
      {editable && (
        <button
          onClick={onDelete}
          className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-red-500 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Inline editable set for the "with targets" 3-column view
function ActualSetRow({
  set,
  editable,
  targetWeight,
  targetReps,
  onUpdate,
  onDelete,
}: {
  set: WorkoutSet;
  editable?: boolean;
  targetWeight: number;
  targetReps: number;
  onUpdate?: (updatedSet: WorkoutSet) => void;
  onDelete?: () => void;
}) {
  const isPR = set.computed?.isPR || set.prFlags?.e1rmPR || set.prFlags?.weightPR;
  const [isEditing, setIsEditing] = useState(false);
  const [weight, setWeight] = useState(set.weight.toString());
  const [reps, setReps] = useState(set.actualReps.toString());

  const handleSave = useCallback(() => {
    const newWeight = parseFloat(weight) || 0;
    const newReps = parseInt(reps) || 0;

    if (newWeight !== set.weight || newReps !== set.actualReps) {
      onUpdate?.({
        ...set,
        weight: newWeight,
        actualReps: newReps,
        computed: {
          volume: newWeight * newReps,
          e1rm: calculateE1RM(newWeight, newReps),
          isPR: set.computed?.isPR || false,
        }
      });
    }
    setIsEditing(false);
  }, [weight, reps, set, onUpdate]);

  if (editable && isEditing) {
    return (
      <div className="flex items-center gap-1 group">
        <span className="text-xs text-[var(--color-muted)] w-4">{set.setNumber}.</span>
        <input
          type="number"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
          className="w-12 px-1 py-0.5 text-xs text-center border border-[var(--color-accent)] rounded bg-transparent focus:outline-none"
        />
        <span className="text-[var(--color-muted)]">×</span>
        <input
          type="number"
          value={reps}
          onChange={e => setReps(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="w-10 px-1 py-0.5 text-xs text-center border border-[var(--color-accent)] rounded bg-transparent focus:outline-none"
        />
        <button onClick={handleSave} className="p-0.5 text-green-600 hover:text-green-700">
          <Check className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const isSpecial = set.setType && set.setType !== 'working';

  return (
    <div
      className="group cursor-pointer py-1"
      onClick={() => editable && setIsEditing(true)}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--color-muted)] w-4">{set.setNumber}.</span>
        <span className={`text-sm font-semibold ${getProgressColor(set.weight, targetWeight)}`}>
          {set.weight}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">{set.weightUnit}</span>
        <span className="text-xs text-[var(--color-muted)]">×</span>
        <span className={`text-sm font-semibold ${getProgressColor(set.actualReps, targetReps)}`}>
          {set.actualReps}
        </span>
        {isPR && <Trophy className="w-3 h-3 text-amber-500" />}
        {/* Set type badge - inline */}
        {isSpecial && (
          <span className="text-[9px] px-1 py-0.5 border border-[var(--color-accent)] text-[var(--color-accent)] font-medium uppercase">
            {set.setType?.replace(/_/g, ' ')}
          </span>
        )}
        {editable && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Add set form component
function AddSetForm({
  exercise,
  preferredUnit,
  onAdd,
  onCancel
}: {
  exercise: ExerciseEntry;
  preferredUnit: WeightUnit;
  onAdd: (set: Omit<WorkoutSet, 'setNumber'>) => void;
  onCancel: () => void;
}) {
  const lastSet = exercise.sets[exercise.sets.length - 1];
  const [weight, setWeight] = useState(lastSet?.weight.toString() || '');
  const [reps, setReps] = useState(lastSet?.actualReps.toString() || '');
  const [setType, setSetType] = useState<SetType>('working');
  const [rpe, setRpe] = useState('');

  const handleAdd = () => {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (r > 0) {
      onAdd({
        setType,
        actualReps: r,
        weight: w,
        weightUnit: preferredUnit,
        equipmentType: exercise.equipmentType,
        laterality: 'bilateral',
        rpe: rpe ? parseFloat(rpe) : undefined,
        computed: {
          volume: w * r,
          e1rm: calculateE1RM(w, r),
          isPR: false
        }
      });
    }
  };

  return (
    <div className="flex items-center gap-1 py-1 mt-1 border-t border-[var(--color-line)]">
      <input
        type="number"
        value={weight}
        onChange={e => setWeight(e.target.value)}
        placeholder={preferredUnit}
        className="w-14 px-1 py-0.5 border border-[var(--color-line)] text-xs bg-transparent"
      />
      <span className="text-[var(--color-muted)] text-xs">×</span>
      <input
        type="number"
        value={reps}
        onChange={e => setReps(e.target.value)}
        placeholder="reps"
        className="w-12 px-1 py-0.5 border border-[var(--color-line)] text-xs bg-transparent"
      />
      <select
        value={setType}
        onChange={e => setSetType(e.target.value as SetType)}
        className="w-20 px-1 py-0.5 border border-[var(--color-line)] text-[10px] bg-transparent"
      >
        {setTypeOptions.map(st => (
          <option key={st} value={st}>{formatSetType(st)}</option>
        ))}
      </select>
      <button onClick={handleAdd} className="p-0.5 text-[var(--color-text)] hover:opacity-70">
        <Check className="w-3 h-3" />
      </button>
      <button onClick={onCancel} className="p-0.5 text-[var(--color-muted)] hover:text-[var(--color-text)]">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// Exercise section component with tabbed interface
function ExerciseSection({
  exercise,
  editable,
  preferredUnit,
  onUpdateExercise,
  onDeleteExercise
}: {
  exercise: ExerciseEntry;
  editable?: boolean;
  preferredUnit: WeightUnit;
  onUpdateExercise?: (exercise: ExerciseEntry) => void;
  onDeleteExercise?: () => void;
}) {
  const [addingSet, setAddingSet] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // Expanded by default
  const [activeTab, setActiveTab] = useState<'actual' | 'target' | 'previous'>('actual');

  const totalReps = exercise.sets.reduce((sum, s) => sum + s.actualReps, 0);
  const totalVolume = exercise.sets.reduce((sum, s) => sum + (s.weight * s.actualReps), 0);
  const unit = exercise.sets[0]?.weightUnit || exercise.targets?.weightUnit || preferredUnit;
  const hasTargets = !!exercise.targets;
  const targetSets = exercise.targets?.sets || 3;
  const hasPR = exercise.sets.some(s => s.computed?.isPR || s.prFlags?.e1rmPR || s.prFlags?.weightPR);

  const handleUpdateSet = useCallback((setNumber: number, updatedSet: WorkoutSet) => {
    const updatedSets = exercise.sets.map(s =>
      s.setNumber === setNumber ? { ...updatedSet, setNumber } : s
    );
    onUpdateExercise?.({ ...exercise, sets: updatedSets });
  }, [exercise, onUpdateExercise]);

  const handleDeleteSet = useCallback((setNumber: number) => {
    const updatedSets = exercise.sets
      .filter(s => s.setNumber !== setNumber)
      .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    onUpdateExercise?.({ ...exercise, sets: updatedSets });
  }, [exercise, onUpdateExercise]);

  const handleAddSet = (newSet: Omit<WorkoutSet, 'setNumber'>) => {
    const updatedSets = [
      ...exercise.sets,
      { ...newSet, setNumber: exercise.sets.length + 1 }
    ];
    onUpdateExercise?.({ ...exercise, sets: updatedSets });
    setAddingSet(false);
  };

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0 py-3 px-3 sm:px-4">
      {/* Exercise header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
          )}
          <span className="font-semibold text-sm text-[var(--color-text)]">{exercise.exerciseName}</span>
          {hasPR && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
        </div>

        {/* Metric tags row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-6">
          <span className={`text-[10px] px-1.5 py-0.5 font-medium ${getMuscleGroupColor(exercise.muscleGroup)}`}>
            {formatMuscleGroup(exercise.muscleGroup)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] text-[var(--color-text)] font-medium">
            {exercise.sets.length}/{targetSets}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] text-[var(--color-text)] font-medium">
            {totalReps} reps
          </span>
          {totalVolume > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] text-[var(--color-text)] font-medium">
              {totalVolume.toLocaleString()} {unit}
            </span>
          )}
        </div>
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
      {/* Tabbed interface */}
      {hasTargets ? (
        <div className="mt-3 ml-6">
          {/* Tab buttons */}
          <TabBar
            tabs={[
              { id: 'actual', label: 'ACTUAL' },
              { id: 'target', label: 'TARGET' },
              { id: 'previous', label: 'PREV' },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as typeof activeTab)}
            size="sm"
          />

          {/* Tab content */}
          <div className="py-3">
            {/* ACTUAL Tab */}
            {activeTab === 'actual' && (
              <div className="space-y-1">
                {exercise.sets.map((set) => (
                  <ActualSetRow
                    key={set.setNumber}
                    set={set}
                    editable={editable}
                    targetWeight={exercise.targets?.weight || 0}
                    targetReps={exercise.targets?.reps || 0}
                    onUpdate={(updatedSet) => handleUpdateSet(set.setNumber, updatedSet)}
                    onDelete={() => handleDeleteSet(set.setNumber)}
                  />
                ))}
                {/* Empty placeholders */}
                {Array.from({ length: Math.max(0, targetSets - exercise.sets.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-2 text-[var(--color-muted)] py-1">
                    <span className="text-xs w-4">{exercise.sets.length + i + 1}.</span>
                    <span className="text-xs">—</span>
                  </div>
                ))}
                {/* Add set button */}
                {editable && !addingSet && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingSet(true); }}
                    className="flex items-center gap-1 mt-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  >
                    <Plus className="w-3 h-3" />
                    add set
                  </button>
                )}
                {addingSet && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <AddSetForm
                      exercise={exercise}
                      preferredUnit={preferredUnit}
                      onAdd={handleAddSet}
                      onCancel={() => setAddingSet(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* TARGET Tab */}
            {activeTab === 'target' && (
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-semibold">{exercise.targets?.weight}</span>
                  <span className="text-xs text-[var(--color-muted)]">{exercise.targets?.weightUnit}</span>
                  <span className="text-xs text-[var(--color-muted)]">×</span>
                  <span className="text-base font-semibold">{exercise.targets?.reps}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                    {exercise.targets?.sets} sets
                  </span>
                  {exercise.targets?.confidence && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                      {exercise.targets.confidence}
                    </span>
                  )}
                </div>
                {exercise.targets?.rationale && (
                  <p className="text-[11px] text-[var(--color-muted)] border-l border-[var(--color-line)] pl-2">
                    {exercise.targets.rationale}
                  </p>
                )}
              </div>
            )}

            {/* PREVIOUS Tab */}
            {activeTab === 'previous' && (
              <div className="space-y-2">
                {exercise.computed?.lastSession ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-semibold">{exercise.computed.lastSession.topSet.weight}</span>
                      <span className="text-xs text-[var(--color-muted)]">{unit}</span>
                      <span className="text-xs text-[var(--color-muted)]">×</span>
                      <span className="text-base font-semibold">{exercise.computed.lastSession.topSet.reps}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                      {formatDate(exercise.computed.lastSession.date)}
                    </span>
                  </>
                ) : (
                  <p className="text-xs text-[var(--color-muted)]">First time</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Simple layout when no targets */
        <div className="mt-3 ml-6 py-2 border-t border-[var(--color-line)]">
          {/* Last session context */}
          {exercise.computed?.lastSession && (
            <div className="mb-2 pb-2 border-b border-[var(--color-line)]">
              <span className="text-[10px] text-[var(--color-muted)] uppercase">Previous</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-semibold">{exercise.computed.lastSession.topSet.weight}{unit}</span>
                <span className="text-xs text-[var(--color-muted)]">×</span>
                <span className="text-sm font-semibold">{exercise.computed.lastSession.topSet.reps}</span>
                <span className="text-[10px] text-[var(--color-muted)]">{formatDate(exercise.computed.lastSession.date)}</span>
              </div>
            </div>
          )}

          {/* Sets */}
          <div className="space-y-1">
            {exercise.sets.map((set) => (
              <InlineSetRow
                key={set.setNumber}
                set={set}
                editable={editable}
                preferredUnit={preferredUnit}
                onUpdate={(updatedSet) => handleUpdateSet(set.setNumber, updatedSet)}
                onDelete={() => handleDeleteSet(set.setNumber)}
              />
            ))}
          </div>

          {/* Add set button */}
          {editable && !addingSet && (
            <button
              onClick={(e) => { e.stopPropagation(); setAddingSet(true); }}
              className="flex items-center gap-1 mt-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              <Plus className="w-3 h-3" />
              add set
            </button>
          )}

          {addingSet && (
            <div onClick={(e) => e.stopPropagation()}>
              <AddSetForm
                exercise={exercise}
                preferredUnit={preferredUnit}
                onAdd={handleAddSet}
                onCancel={() => setAddingSet(false)}
              />
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}

// Add exercise form component
function AddExerciseForm({
  preferredUnit,
  onAdd,
  onCancel
}: {
  preferredUnit: WeightUnit;
  onAdd: (exercise: Omit<ExerciseEntry, 'id' | 'orderIndex'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<EquipmentType>('barbell');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd({
        exerciseName: name.trim(),
        muscleGroup,
        equipmentType: equipment,
        sets: []
      });
    }
  };

  return (
    <div className="py-2 mt-2 border-t border-[var(--color-line)]">
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Exercise name"
          className="w-full px-2 py-1 border border-[var(--color-line)] text-xs bg-transparent"
        />

        <div className="flex gap-1">
          <select
            value={muscleGroup}
            onChange={e => setMuscleGroup(e.target.value as MuscleGroup)}
            className="flex-1 px-1 py-1 border border-[var(--color-line)] text-xs bg-transparent"
          >
            {muscleGroupOptions.map(mg => (
              <option key={mg} value={mg}>{formatMuscleGroup(mg)}</option>
            ))}
          </select>

          <select
            value={equipment}
            onChange={e => setEquipment(e.target.value as EquipmentType)}
            className="flex-1 px-1 py-1 border border-[var(--color-line)] text-xs bg-transparent"
          >
            {equipmentOptions.map(eq => (
              <option key={eq} value={eq}>{formatEquipmentType(eq)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="px-2 py-1 text-xs bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-80 disabled:opacity-50"
        >
          add
        </button>
      </div>
    </div>
  );
}

// Summary bar component
function WorkoutSummaryBar({ summary, preferredUnit, computed }: {
  summary: WorkoutLog['summary'];
  preferredUnit: WorkoutLog['preferredUnit'];
  computed?: WorkoutLog['computed'];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)] py-1 px-5 sm:px-7 border-b border-[var(--color-line)]">
      <span>{summary.totalExercises} exercises</span>
      <span>·</span>
      <span>{summary.totalSets} sets</span>
      <span>·</span>
      <span>{summary.totalVolume.toLocaleString()} {preferredUnit}</span>
      {summary.prCount > 0 && (
        <>
          <span>·</span>
          <span className="text-amber-600 font-medium">{summary.prCount} PR</span>
        </>
      )}
    </div>
  );
}

/**
 * WorkoutLogCard - Displays structured workout data
 * Supports editable mode for manual workout modifications
 */
export function WorkoutLogCard({ workoutLog, isLoading, editable, onUpdate }: WorkoutLogCardProps) {
  const [addingExercise, setAddingExercise] = useState(false);

  const handleUpdateExercise = useCallback((updatedExercise: ExerciseEntry) => {
    if (!workoutLog || !onUpdate) return;

    const updatedExercises = workoutLog.exercises.map(e =>
      e.id === updatedExercise.id ? updatedExercise : e
    );

    // Recalculate summary
    const totalSets = updatedExercises.reduce((sum, e) => sum + e.sets.length, 0);
    const totalReps = updatedExercises.reduce((sum, e) =>
      sum + e.sets.reduce((s, set) => s + set.actualReps, 0), 0);
    const totalVolume = updatedExercises.reduce((sum, e) =>
      sum + e.sets.reduce((s, set) => s + set.weight * set.actualReps, 0), 0);
    const prCount = updatedExercises.reduce((sum, e) =>
      sum + e.sets.filter(s => s.computed?.isPR || s.prFlags?.e1rmPR).length, 0);

    const muscleGroups = [...new Set(updatedExercises.map(e => e.muscleGroup))];

    onUpdate({
      ...workoutLog,
      exercises: updatedExercises,
      muscleGroups,
      summary: {
        totalExercises: updatedExercises.length,
        totalSets,
        totalReps,
        totalVolume,
        totalVolumeUnit: workoutLog.preferredUnit,
        muscleGroupsWorked: muscleGroups,
        prCount
      },
      updatedAt: new Date().toISOString()
    });
  }, [workoutLog, onUpdate]);

  const handleDeleteExercise = useCallback((exerciseId: string) => {
    if (!workoutLog || !onUpdate) return;

    const updatedExercises = workoutLog.exercises
      .filter(e => e.id !== exerciseId)
      .map((e, idx) => ({ ...e, orderIndex: idx }));

    // Recalculate summary
    const totalSets = updatedExercises.reduce((sum, e) => sum + e.sets.length, 0);
    const totalReps = updatedExercises.reduce((sum, e) =>
      sum + e.sets.reduce((s, set) => s + set.actualReps, 0), 0);
    const totalVolume = updatedExercises.reduce((sum, e) =>
      sum + e.sets.reduce((s, set) => s + set.weight * set.actualReps, 0), 0);
    const prCount = updatedExercises.reduce((sum, e) =>
      sum + e.sets.filter(s => s.computed?.isPR || s.prFlags?.e1rmPR).length, 0);

    const muscleGroups = [...new Set(updatedExercises.map(e => e.muscleGroup))];

    onUpdate({
      ...workoutLog,
      exercises: updatedExercises,
      muscleGroups,
      summary: {
        totalExercises: updatedExercises.length,
        totalSets,
        totalReps,
        totalVolume,
        totalVolumeUnit: workoutLog.preferredUnit,
        muscleGroupsWorked: muscleGroups,
        prCount
      },
      updatedAt: new Date().toISOString()
    });
  }, [workoutLog, onUpdate]);

  const handleAddExercise = useCallback((exercise: Omit<ExerciseEntry, 'id' | 'orderIndex'>) => {
    if (!workoutLog || !onUpdate) return;

    const newExercise: ExerciseEntry = {
      ...exercise,
      id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderIndex: workoutLog.exercises.length
    };

    const updatedExercises = [...workoutLog.exercises, newExercise];
    const muscleGroups = [...new Set(updatedExercises.map(e => e.muscleGroup))];

    onUpdate({
      ...workoutLog,
      exercises: updatedExercises,
      muscleGroups,
      summary: {
        ...workoutLog.summary,
        totalExercises: updatedExercises.length,
        muscleGroupsWorked: muscleGroups
      },
      updatedAt: new Date().toISOString()
    });

    setAddingExercise(false);
  }, [workoutLog, onUpdate]);

  // Determine if we have valid data to show
  const hasData = workoutLog && workoutLog.exercises.length > 0;
  const isEmpty = !workoutLog || workoutLog.exercises.length === 0;

  return (
    <div className="py-3 bg-[var(--color-surface)] overflow-x-hidden">
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-[var(--color-muted)]/20 w-1/3" />
          <div className="h-16 bg-[var(--color-muted)]/20" />
        </div>
      ) : isEmpty ? (
        /* Empty state */
        <div className="px-5 sm:px-7">
          <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] py-2">
            <span className="flex items-center gap-1">
              <Dumbbell className="w-3.5 h-3.5" />
              0 exercises
            </span>
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              0 sets
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-muted)] py-3 border-t border-[var(--color-line)] mt-1">
            Log your workout below
          </p>
        </div>
      ) : hasData && workoutLog && (
        <div>
          {/* Template name badge */}
          {workoutLog.templateName && (
            <div className="flex items-center gap-1.5 px-5 sm:px-7 mb-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-lime)]/20 text-[var(--color-lime)] font-medium">
                From: {workoutLog.templateName}
              </span>
            </div>
          )}

          {/* Muscle group badges */}
          {workoutLog.muscleGroups.length > 0 && (
            <div className="flex gap-1 mb-2 px-5 sm:px-7">
              {workoutLog.muscleGroups.filter(Boolean).slice(0, 3).map(mg => (
                <span key={mg} className={`text-[10px] px-1.5 py-0.5 font-medium ${getMuscleGroupColor(mg)}`}>
                  {formatMuscleGroup(mg)}
                </span>
              ))}
            </div>
          )}

          {/* Summary bar */}
          <WorkoutSummaryBar summary={workoutLog.summary} preferredUnit={workoutLog.preferredUnit} computed={workoutLog.computed} />

          {/* Exercises */}
          <div className="mt-2">
            {workoutLog.exercises.map(exercise => (
              <ExerciseSection
                key={exercise.id}
                exercise={exercise}
                editable={editable}
                preferredUnit={workoutLog.preferredUnit}
                onUpdateExercise={handleUpdateExercise}
                onDeleteExercise={() => handleDeleteExercise(exercise.id)}
              />
            ))}
          </div>

          {/* Add exercise button */}
          {editable && !addingExercise && (
            <button
              onClick={() => setAddingExercise(true)}
              className="flex items-center gap-1 mt-3 px-3 sm:px-4 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              <Plus className="w-3 h-3" />
              add exercise
            </button>
          )}

          {addingExercise && (
            <div className="px-3 sm:px-4">
              <AddExerciseForm
                preferredUnit={workoutLog.preferredUnit}
                onAdd={handleAddExercise}
                onCancel={() => setAddingExercise(false)}
              />
            </div>
          )}

          {/* Coach note */}
          {workoutLog.notes && (
            <div className="px-4 py-2.5 border-t border-[var(--color-line)] mt-1">
              <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Coach note</p>
              <p className="text-xs text-[var(--color-text)]">{workoutLog.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
