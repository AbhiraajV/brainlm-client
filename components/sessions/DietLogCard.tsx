'use client';

import { useState, useCallback, useRef } from 'react';
import type { DietLog, MealEntry, FoodItem, MealType, Macros, FoodSource } from '@/lib/sessions/types';
import { ChevronDown, ChevronRight, Flame, Beef, Wheat, Droplets, Trash2, Plus, X, Check } from 'lucide-react';
import { recalculateDietSummary, generateId, getMealOrder } from '@/lib/diet/macros';

interface DietLogCardProps {
  dietLog: DietLog | undefined;
  isLoading?: boolean;
  editable?: boolean;
  onUpdate?: (dietLog: DietLog) => void;
}

// Meal type icons and labels
const mealTypeConfig: Record<MealType, { icon: string; label: string }> = {
  breakfast: { icon: '🌅', label: 'Breakfast' },
  morning_snack: { icon: '🍎', label: 'Morning Snack' },
  lunch: { icon: '☀️', label: 'Lunch' },
  afternoon_snack: { icon: '🥜', label: 'Afternoon Snack' },
  dinner: { icon: '🌙', label: 'Dinner' },
  evening_snack: { icon: '🌃', label: 'Evening Snack' },
  pre_workout: { icon: '💪', label: 'Pre-Workout' },
  post_workout: { icon: '🏋️', label: 'Post-Workout' },
  other: { icon: '🍽️', label: 'Other' },
};

const MEAL_TYPE_OPTIONS: MealType[] = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
  'dinner', 'evening_snack', 'pre_workout', 'post_workout', 'other'
];

// Progress color based on percentage - using CSS variables
function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'text-[var(--color-error)]';
  if (percentage >= 90) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-success)]';
}

// Progress bar color - using CSS variables
function getProgressBarColor(percentage: number): string {
  if (percentage >= 100) return 'bg-[var(--color-error)]';
  if (percentage >= 90) return 'bg-[var(--color-warning)]';
  return 'bg-[var(--color-success)]';
}

// Macro icon row component
function MacroIconRow({ macros, targets, label }: {
  macros: Macros;
  targets?: Macros;
  label?: string;
}) {
  const showProgress = !!targets;

  return (
    <div className="flex items-center gap-4 text-xs flex-wrap">
      {label && (
        <span className="text-[var(--color-muted)] font-medium w-16">{label}</span>
      )}
      <span className="flex items-center gap-1">
        <Flame className="w-3.5 h-3.5 text-orange-500" />
        <span className="font-medium">{Math.round(macros.calories)}</span>
        {showProgress && targets && (
          <span className="text-[var(--color-muted)]">/ {targets.calories}</span>
        )}
        <span className="text-[var(--color-muted)]">cal</span>
      </span>
      <span className="flex items-center gap-1">
        <Beef className="w-3.5 h-3.5 text-red-500" />
        <span className="font-medium">{Math.round(macros.protein)}g</span>
        {showProgress && targets && (
          <span className="text-[var(--color-muted)]">/ {targets.protein}g</span>
        )}
      </span>
      <span className="flex items-center gap-1">
        <Wheat className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-medium">{Math.round(macros.carbs)}g</span>
      </span>
      <span className="flex items-center gap-1">
        <Droplets className="w-3.5 h-3.5 text-yellow-500" />
        <span className="font-medium">{Math.round(macros.fat)}g</span>
      </span>
    </div>
  );
}

// Progress indicator component
function ProgressIndicator({ percentage, label }: { percentage: number; label: string }) {
  const clampedPercentage = Math.min(percentage, 100);
  const colorClass = getProgressBarColor(percentage);

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className={getProgressColor(percentage)}>{Math.round(percentage)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--color-line)] rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-300`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}

// Format loggedAt timestamp to short time string
function formatLoggedAt(loggedAt: string): string {
  try {
    const d = new Date(loggedAt);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Column header row with icons — rendered per food item below title/timestamp
function MacroColumnHeaders() {
  return (
    <div className="grid grid-cols-4 gap-1.5 mt-1.5 mb-0.5">
      <div className="flex items-center justify-center gap-0.5 text-[10px] text-[var(--color-muted)]">
        <Flame className="w-3 h-3 text-orange-500" />
        <span>Cal</span>
      </div>
      <div className="flex items-center justify-center gap-0.5 text-[10px] text-[var(--color-muted)]">
        <Beef className="w-3 h-3 text-red-500" />
        <span>Protein</span>
      </div>
      <div className="flex items-center justify-center gap-0.5 text-[10px] text-[var(--color-muted)]">
        <Wheat className="w-3 h-3 text-amber-600" />
        <span>Carbs</span>
      </div>
      <div className="flex items-center justify-center gap-0.5 text-[10px] text-[var(--color-muted)]">
        <Droplets className="w-3 h-3 text-yellow-500" />
        <span>Fat</span>
      </div>
    </div>
  );
}

// Editable food item row — full-width name + timestamp, then macro table row
function EditableFoodRow({
  food,
  editable,
  onUpdate,
  onDelete
}: {
  food: FoodItem;
  editable?: boolean;
  onUpdate?: (food: FoodItem) => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState({
    name: food.name,
    calories: food.macros.calories,
    protein: food.macros.protein,
    carbs: food.macros.carbs,
    fat: food.macros.fat,
  });

  // Sync if food changes from outside (e.g. agent update)
  const prevFoodRef = useRef(food);
  if (
    prevFoodRef.current.name !== food.name ||
    prevFoodRef.current.macros.calories !== food.macros.calories ||
    prevFoodRef.current.macros.protein !== food.macros.protein ||
    prevFoodRef.current.macros.carbs !== food.macros.carbs ||
    prevFoodRef.current.macros.fat !== food.macros.fat
  ) {
    prevFoodRef.current = food;
    setValues({
      name: food.name,
      calories: food.macros.calories,
      protein: food.macros.protein,
      carbs: food.macros.carbs,
      fat: food.macros.fat,
    });
  }

  const commitField = useCallback((field: string, raw: string) => {
    const num = parseFloat(raw) || 0;
    const updated = { ...values, [field]: field === 'name' ? raw : num };
    setValues(updated);
    if (onUpdate) {
      onUpdate({
        ...food,
        name: updated.name,
        macros: {
          calories: typeof updated.calories === 'number' ? updated.calories : food.macros.calories,
          protein: typeof updated.protein === 'number' ? updated.protein : food.macros.protein,
          carbs: typeof updated.carbs === 'number' ? updated.carbs : food.macros.carbs,
          fat: typeof updated.fat === 'number' ? updated.fat : food.macros.fat,
        },
      });
    }
  }, [food, values, onUpdate]);

  const timeStr = formatLoggedAt(food.loggedAt);
  const servingInfo = food.servingSize > 0 ? `${food.servingSize}${food.servingUnit}` : '';

  if (!editable) {
    return (
      <div className="py-2 px-1 border-b border-[var(--color-line)] last:border-b-0">
        {/* Name row */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--color-text)]">{food.name}</span>
          {editable && (
            <button onClick={onDelete} className="p-1 text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Subtitle: timestamp + serving */}
        <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)] mt-0.5">
          {timeStr && <span>{timeStr}</span>}
          {servingInfo && <span>{servingInfo}</span>}
          {food.brand && <span>{food.brand}</span>}
        </div>
        {/* Macro icon headers + values */}
        <MacroColumnHeaders />
        <div className="grid grid-cols-4 gap-1.5">
          <span className="text-center text-[12px] font-medium text-[var(--color-text)]">{Math.round(food.macros.calories)}</span>
          <span className="text-center text-[12px] font-medium text-[var(--color-text)]">{Math.round(food.macros.protein)}g</span>
          <span className="text-center text-[12px] font-medium text-[var(--color-text)]">{Math.round(food.macros.carbs)}g</span>
          <span className="text-center text-[12px] font-medium text-[var(--color-text)]">{Math.round(food.macros.fat)}g</span>
        </div>
      </div>
    );
  }

  // Editable layout
  return (
    <div className="py-2 px-1 border-b border-[var(--color-line)] last:border-b-0">
      {/* Name row — full width input + delete */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={values.name}
          onChange={e => setValues(prev => ({ ...prev, name: e.target.value }))}
          onBlur={e => commitField('name', e.target.value)}
          className="flex-1 min-w-0 px-1.5 py-1 text-[13px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
          placeholder="Food name"
        />
        <button
          onClick={onDelete}
          className="p-1 text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors flex-shrink-0"
          title="Delete food"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Subtitle: timestamp + serving */}
      <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)] mt-0.5 px-0.5">
        {timeStr && <span>{timeStr}</span>}
        {servingInfo && <span>{servingInfo}</span>}
        {food.brand && <span>{food.brand}</span>}
      </div>
      {/* Macro icon headers + inputs */}
      <MacroColumnHeaders />
      <div className="grid grid-cols-4 gap-1.5">
        <input
          type="number"
          value={values.calories}
          onChange={e => setValues(prev => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
          onBlur={e => commitField('calories', e.target.value)}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
        />
        <input
          type="number"
          value={values.protein}
          onChange={e => setValues(prev => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))}
          onBlur={e => commitField('protein', e.target.value)}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
        />
        <input
          type="number"
          value={values.carbs}
          onChange={e => setValues(prev => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
          onBlur={e => commitField('carbs', e.target.value)}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
        />
        <input
          type="number"
          value={values.fat}
          onChange={e => setValues(prev => ({ ...prev, fat: parseFloat(e.target.value) || 0 }))}
          onBlur={e => commitField('fat', e.target.value)}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
        />
      </div>
    </div>
  );
}

// Add food form — matching EditableFoodRow layout
function AddFoodForm({
  onAdd,
  onCancel
}: {
  onAdd: (food: Omit<FoodItem, 'id' | 'loggedAt'>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const handleSubmit = () => {
    if (!values.name.trim()) return;
    onAdd({
      name: values.name,
      source: 'other' as FoodSource,
      servingSize: 1,
      servingUnit: 'serving',
      macros: {
        calories: values.calories,
        protein: values.protein,
        carbs: values.carbs,
        fat: values.fat,
      },
    });
  };

  return (
    <div className="py-2 px-1 border border-dashed border-[var(--color-line)]">
      {/* Name row + action buttons */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={values.name}
          onChange={e => setValues(prev => ({ ...prev, name: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          className="flex-1 min-w-0 px-1.5 py-1 text-[13px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
          placeholder="Food name"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          className="p-1 text-[var(--color-success)] hover:text-[var(--color-text)] transition-colors flex-shrink-0"
          title="Add food"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors flex-shrink-0"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Macro icon headers + inputs */}
      <MacroColumnHeaders />
      <div className="grid grid-cols-4 gap-1.5">
        <input
          type="number"
          value={values.calories || ''}
          onChange={e => setValues(prev => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
          placeholder="0"
        />
        <input
          type="number"
          value={values.protein || ''}
          onChange={e => setValues(prev => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
          placeholder="0"
        />
        <input
          type="number"
          value={values.carbs || ''}
          onChange={e => setValues(prev => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
          placeholder="0"
        />
        <input
          type="number"
          value={values.fat || ''}
          onChange={e => setValues(prev => ({ ...prev, fat: parseFloat(e.target.value) || 0 }))}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          className="w-full px-1 py-1 text-center text-[12px] bg-transparent border border-[var(--color-line)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-muted)]"
          placeholder="0"
        />
      </div>
    </div>
  );
}

// Meal section component
function MealSection({
  meal,
  editable,
  onUpdateFood,
  onDeleteFood,
  onAddFood,
  onDeleteMeal,
}: {
  meal: MealEntry;
  editable?: boolean;
  onUpdateFood?: (foodId: string, food: FoodItem) => void;
  onDeleteFood?: (foodId: string) => void;
  onAddFood?: (food: Omit<FoodItem, 'id' | 'loggedAt'>) => void;
  onDeleteMeal?: () => void;
}) {
  const config = mealTypeConfig[meal.mealType];
  const [showAddFood, setShowAddFood] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0 py-3 px-3 sm:px-4">
      {/* Meal header */}
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
          <span className="text-base">{config.icon}</span>
          <span className="font-semibold text-sm text-[var(--color-text)]">{config.label}</span>
          {meal.time && (
            <span className="text-xs text-[var(--color-muted)]">{meal.time}</span>
          )}
        </div>

        {/* Metric tags row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-6">
          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] text-[var(--color-text)] font-medium">
            {meal.foods.length} items
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-600 font-medium">
            {Math.round(meal.totalMacros.calories)} cal
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-600 font-medium">
            {Math.round(meal.totalMacros.protein)}g P
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-600 font-medium">
            {Math.round(meal.totalMacros.carbs)}g C
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-600 font-medium">
            {Math.round(meal.totalMacros.fat)}g F
          </span>
        </div>
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="mt-3">
          <div>
            {meal.foods.map(food => (
              <EditableFoodRow
                key={food.id}
                food={food}
                editable={editable}
                onUpdate={f => onUpdateFood?.(food.id, f)}
                onDelete={() => onDeleteFood?.(food.id)}
              />
            ))}
            {meal.foods.length === 0 && (
              <p className="text-xs text-[var(--color-muted)]">No foods logged yet</p>
            )}
            {/* Add food button */}
            {editable && !showAddFood && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddFood(true); }}
                className="flex items-center gap-1 mt-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <Plus className="w-3 h-3" />
                add food
              </button>
            )}
            {showAddFood && (
              <div onClick={(e) => e.stopPropagation()}>
                <AddFoodForm
                  onAdd={(food) => {
                    onAddFood?.(food);
                    setShowAddFood(false);
                  }}
                  onCancel={() => setShowAddFood(false)}
                />
              </div>
            )}
          </div>

          {/* Delete meal button */}
          {editable && (
            <div className="mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteMeal?.(); }}
                className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                delete meal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Add meal form component
function AddMealForm({
  existingMealTypes,
  onAdd,
  onCancel
}: {
  existingMealTypes: MealType[];
  onAdd: (mealType: MealType) => void;
  onCancel: () => void;
}) {
  const availableTypes = MEAL_TYPE_OPTIONS.filter(t => !existingMealTypes.includes(t));
  const [selectedType, setSelectedType] = useState<MealType>(availableTypes[0] || 'other');

  if (availableTypes.length === 0) {
    return (
      <div className="py-2 px-3 text-sm text-[var(--color-muted)] bg-[var(--color-background)] rounded border border-[var(--color-line)]">
        All meal types already exist.
        <button
          onClick={onCancel}
          className="ml-2 text-[var(--color-text)] hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="py-2 px-3 bg-[var(--color-background)] rounded border border-[var(--color-line)] flex items-center gap-2">
      <select
        value={selectedType}
        onChange={e => setSelectedType(e.target.value as MealType)}
        className="flex-1 px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
      >
        {availableTypes.map(type => (
          <option key={type} value={type}>{mealTypeConfig[type].label}</option>
        ))}
      </select>
      <button
        onClick={onCancel}
        className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <button
        onClick={() => onAdd(selectedType)}
        className="p-1 text-[var(--color-success)] hover:text-[var(--color-text)] transition-colors"
      >
        <Check className="w-4 h-4" />
      </button>
    </div>
  );
}

// Summary bar component (matching WorkoutLogCard pattern)
function DietSummaryBar({ summary, targets }: {
  summary: DietLog['summary'];
  targets?: DietLog['targets'];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)] py-1 px-5 sm:px-7 border-b border-[var(--color-line)]">
      <span>{summary.totalMeals} meals</span>
      <span>·</span>
      <span>{summary.totalFoods} foods</span>
      <span>·</span>
      <span className="text-orange-600">{Math.round(summary.progress.consumed.calories)} cal</span>
      {targets && (
        <>
          <span className="text-[var(--color-muted)]">/ {targets.calories}</span>
        </>
      )}
      <span>·</span>
      <span className="text-red-600">{Math.round(summary.progress.consumed.protein)}g P</span>
      {targets && (
        <>
          <span className="text-[var(--color-muted)]">/ {targets.protein}g</span>
        </>
      )}
    </div>
  );
}

/**
 * DietLogCard - Displays structured diet data with macro tracking
 * Supports editing and tabbed interface matching WorkoutLogCard
 */
export function DietLogCard({ dietLog, isLoading, editable, onUpdate }: DietLogCardProps) {
  const [showAddMeal, setShowAddMeal] = useState(false);

  const handleAddMeal = useCallback((mealType: MealType) => {
    if (!dietLog || !onUpdate) return;

    const newMeal: MealEntry = {
      id: generateId('meal'),
      mealType,
      foods: [],
      totalMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      orderIndex: dietLog.meals.length,
    };

    const updatedMeals = [...dietLog.meals, newMeal].sort(
      (a, b) => getMealOrder(a.mealType) - getMealOrder(b.mealType)
    );

    const reindexedMeals = updatedMeals.map((meal, index) => ({
      ...meal,
      orderIndex: index,
    }));

    onUpdate(recalculateDietSummary({
      ...dietLog,
      meals: reindexedMeals,
    }));

    setShowAddMeal(false);
  }, [dietLog, onUpdate]);

  const handleDeleteMeal = useCallback((mealId: string) => {
    if (!dietLog || !onUpdate) return;

    const updatedMeals = dietLog.meals
      .filter(m => m.id !== mealId)
      .map((meal, index) => ({ ...meal, orderIndex: index }));

    onUpdate(recalculateDietSummary({
      ...dietLog,
      meals: updatedMeals,
    }));
  }, [dietLog, onUpdate]);

  const handleAddFood = useCallback((mealId: string, food: Omit<FoodItem, 'id' | 'loggedAt'>) => {
    if (!dietLog || !onUpdate) return;

    const mealIndex = dietLog.meals.findIndex(m => m.id === mealId);
    if (mealIndex === -1) return;

    const newFood: FoodItem = {
      ...food,
      id: generateId('food'),
      loggedAt: new Date().toISOString(),
    };

    const updatedMeals = [...dietLog.meals];
    updatedMeals[mealIndex] = {
      ...updatedMeals[mealIndex],
      foods: [...updatedMeals[mealIndex].foods, newFood],
    };

    onUpdate(recalculateDietSummary({
      ...dietLog,
      meals: updatedMeals,
    }));
  }, [dietLog, onUpdate]);

  const handleUpdateFood = useCallback((mealId: string, foodId: string, food: FoodItem) => {
    if (!dietLog || !onUpdate) return;

    const mealIndex = dietLog.meals.findIndex(m => m.id === mealId);
    if (mealIndex === -1) return;

    const foodIndex = dietLog.meals[mealIndex].foods.findIndex(f => f.id === foodId);
    if (foodIndex === -1) return;

    const updatedFoods = [...dietLog.meals[mealIndex].foods];
    updatedFoods[foodIndex] = food;

    const updatedMeals = [...dietLog.meals];
    updatedMeals[mealIndex] = {
      ...updatedMeals[mealIndex],
      foods: updatedFoods,
    };

    onUpdate(recalculateDietSummary({
      ...dietLog,
      meals: updatedMeals,
    }));
  }, [dietLog, onUpdate]);

  const handleDeleteFood = useCallback((mealId: string, foodId: string) => {
    if (!dietLog || !onUpdate) return;

    const mealIndex = dietLog.meals.findIndex(m => m.id === mealId);
    if (mealIndex === -1) return;

    const updatedFoods = dietLog.meals[mealIndex].foods.filter(f => f.id !== foodId);

    const updatedMeals = [...dietLog.meals];
    updatedMeals[mealIndex] = {
      ...updatedMeals[mealIndex],
      foods: updatedFoods,
    };

    onUpdate(recalculateDietSummary({
      ...dietLog,
      meals: updatedMeals,
    }));
  }, [dietLog, onUpdate]);

  const hasData = dietLog && dietLog.meals.length > 0;
  const isEmpty = !dietLog || dietLog.meals.length === 0;

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
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              0 cal
            </span>
            <span className="flex items-center gap-1">
              <Beef className="w-3.5 h-3.5 text-red-500" />
              0g protein
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-muted)] py-3 border-t border-[var(--color-line)] mt-1">
            Log your food below
          </p>
        </div>
      ) : hasData && dietLog && (
        <div>
          {/* Progress bars - top of card */}
          <div className="flex gap-4 mb-3 px-5 sm:px-7">
            <ProgressIndicator
              percentage={dietLog.summary.progress.percentages.calories}
              label="Calories"
            />
            <ProgressIndicator
              percentage={dietLog.summary.progress.percentages.protein}
              label="Protein"
            />
          </div>

          {/* Summary bar */}
          <DietSummaryBar summary={dietLog.summary} targets={dietLog.targets} />

          {/* Meals */}
          <div className="mt-2">
            {dietLog.meals.map(meal => (
              <MealSection
                key={meal.id}
                meal={meal}
                editable={editable}
                onUpdateFood={(foodId, food) => handleUpdateFood(meal.id, foodId, food)}
                onDeleteFood={(foodId) => handleDeleteFood(meal.id, foodId)}
                onAddFood={(food) => handleAddFood(meal.id, food)}
                onDeleteMeal={() => handleDeleteMeal(meal.id)}
              />
            ))}
          </div>

          {/* Add meal button */}
          {editable && !showAddMeal && (
            <button
              onClick={() => setShowAddMeal(true)}
              className="flex items-center gap-1 mt-3 px-3 sm:px-4 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              <Plus className="w-3 h-3" />
              add meal
            </button>
          )}

          {showAddMeal && (
            <div className="px-3 sm:px-4 mt-3">
              <AddMealForm
                existingMealTypes={dietLog.meals.map(m => m.mealType)}
                onAdd={handleAddMeal}
                onCancel={() => setShowAddMeal(false)}
              />
            </div>
          )}

          {/* Water intake */}
          {dietLog.waterIntake && dietLog.waterIntake > 0 && (
            <div className="text-xs text-[var(--color-muted)] mt-3 px-5 sm:px-7 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              Water: {dietLog.waterIntake}ml
            </div>
          )}

          {/* Notes */}
          {dietLog.notes && (
            <p className="text-xs text-[var(--color-muted)] mt-3 px-5 sm:px-7 italic">
              {dietLog.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
