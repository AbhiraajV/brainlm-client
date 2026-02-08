'use client';

import { useState, useCallback } from 'react';
import type { DietLog, MealEntry, FoodItem, MealType, Macros, ServingUnit, FoodSource } from '@/lib/sessions/types';
import { ChevronDown, ChevronRight, Flame, Beef, Wheat, Droplets, Trash2, Plus, X, Check, Edit2 } from 'lucide-react';
import { recalculateDietSummary, generateId, getMealOrder } from '@/lib/diet/macros';
import { TabBar } from '@/components/ui/TabBar';

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

const SERVING_UNIT_OPTIONS: ServingUnit[] = [
  'g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'serving', 'scoop'
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

// Editable food item row component
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
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    name: food.name,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.macros.calories,
    protein: food.macros.protein,
    carbs: food.macros.carbs,
    fat: food.macros.fat,
  });

  const handleSave = () => {
    if (onUpdate) {
      onUpdate({
        ...food,
        name: editValues.name,
        servingSize: editValues.servingSize,
        servingUnit: editValues.servingUnit,
        macros: {
          calories: editValues.calories,
          protein: editValues.protein,
          carbs: editValues.carbs,
          fat: editValues.fat,
        },
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({
      name: food.name,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      calories: food.macros.calories,
      protein: food.macros.protein,
      carbs: food.macros.carbs,
      fat: food.macros.fat,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="py-2 px-1 bg-[var(--color-background)] rounded border border-[var(--color-line)] mb-2">
        <div className="space-y-2">
          <input
            type="text"
            value={editValues.name}
            onChange={e => setEditValues(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
            placeholder="Food name"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={editValues.servingSize}
              onChange={e => setEditValues(prev => ({ ...prev, servingSize: parseFloat(e.target.value) || 0 }))}
              className="w-20 px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
              placeholder="Size"
            />
            <select
              value={editValues.servingUnit}
              onChange={e => setEditValues(prev => ({ ...prev, servingUnit: e.target.value as ServingUnit }))}
              className="px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
            >
              {SERVING_UNIT_OPTIONS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-[var(--color-muted)]">Cal</label>
              <input
                type="number"
                value={editValues.calories}
                onChange={e => setEditValues(prev => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)]">P</label>
              <input
                type="number"
                value={editValues.protein}
                onChange={e => setEditValues(prev => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)]">C</label>
              <input
                type="number"
                value={editValues.carbs}
                onChange={e => setEditValues(prev => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)]">F</label>
              <input
                type="number"
                value={editValues.fat}
                onChange={e => setEditValues(prev => ({ ...prev, fat: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="p-1 text-[var(--color-success)] hover:text-[var(--color-text)] transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm group">
      <div className="flex-1 min-w-0">
        <span className="text-[var(--color-text)] truncate block">
          {food.name}
          {food.brand && (
            <span className="text-[var(--color-muted)] text-xs ml-1">({food.brand})</span>
          )}
        </span>
        <span className="text-xs text-[var(--color-muted)]">
          {food.servingSize} {food.servingUnit}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] ml-2">
        <span>{Math.round(food.macros.calories)} cal</span>
        <span>{Math.round(food.macros.protein)}g P</span>
        {editable && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:text-[var(--color-text)] transition-colors"
              title="Edit food"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 hover:text-[var(--color-error)] transition-colors"
              title="Delete food"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Add food form component
function AddFoodForm({
  onAdd,
  onCancel
}: {
  onAdd: (food: Omit<FoodItem, 'id' | 'loggedAt'>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    name: '',
    servingSize: 1,
    servingUnit: 'serving' as ServingUnit,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) return;

    onAdd({
      name: values.name,
      source: 'other' as FoodSource,
      servingSize: values.servingSize,
      servingUnit: values.servingUnit,
      macros: {
        calories: values.calories,
        protein: values.protein,
        carbs: values.carbs,
        fat: values.fat,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="py-2 px-1 bg-[var(--color-background)] rounded border border-[var(--color-line)] mb-2">
      <div className="space-y-2">
        <input
          type="text"
          value={values.name}
          onChange={e => setValues(prev => ({ ...prev, name: e.target.value }))}
          className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
          placeholder="Food name"
          autoFocus
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={values.servingSize}
            onChange={e => setValues(prev => ({ ...prev, servingSize: parseFloat(e.target.value) || 0 }))}
            className="w-20 px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
            placeholder="Size"
          />
          <select
            value={values.servingUnit}
            onChange={e => setValues(prev => ({ ...prev, servingUnit: e.target.value as ServingUnit }))}
            className="px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
          >
            {SERVING_UNIT_OPTIONS.map(unit => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-[var(--color-muted)]">Cal</label>
            <input
              type="number"
              value={values.calories}
              onChange={e => setValues(prev => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
              className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)]">P</label>
            <input
              type="number"
              value={values.protein}
              onChange={e => setValues(prev => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))}
              className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)]">C</label>
            <input
              type="number"
              value={values.carbs}
              onChange={e => setValues(prev => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
              className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)]">F</label>
            <input
              type="number"
              value={values.fat}
              onChange={e => setValues(prev => ({ ...prev, fat: parseFloat(e.target.value) || 0 }))}
              className="w-full px-2 py-1 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded text-[var(--color-text)]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="submit"
            className="p-1 text-[var(--color-success)] hover:text-[var(--color-text)] transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

// Meal section component with tabbed interface (matching WorkoutLogCard pattern)
function MealSection({
  meal,
  previousMeal,
  targetMacros,
  editable,
  onUpdateFood,
  onDeleteFood,
  onAddFood,
  onDeleteMeal,
}: {
  meal: MealEntry;
  previousMeal?: MealEntry;
  targetMacros?: Macros;
  editable?: boolean;
  onUpdateFood?: (foodId: string, food: FoodItem) => void;
  onDeleteFood?: (foodId: string) => void;
  onAddFood?: (food: Omit<FoodItem, 'id' | 'loggedAt'>) => void;
  onDeleteMeal?: () => void;
}) {
  const config = mealTypeConfig[meal.mealType];
  const [showAddFood, setShowAddFood] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'actual' | 'target' | 'previous'>('actual');

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
        <>
          {/* Tabbed interface - always show */}
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
                )}

                {/* TARGET Tab */}
                {activeTab === 'target' && (
                  <div className="space-y-2">
                    {targetMacros ? (
                      <>
                        <div className="flex items-baseline gap-3">
                          <span className="text-base font-semibold">{targetMacros.calories}</span>
                          <span className="text-xs text-[var(--color-muted)]">cal</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                            {targetMacros.protein}g protein
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                            {targetMacros.carbs}g carbs
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                            {targetMacros.fat}g fat
                          </span>
                        </div>
                        {/* Progress comparison */}
                        <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[var(--color-muted)]">Progress:</span>
                            <span className={meal.totalMacros.calories >= targetMacros.calories ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}>
                              {Math.round((meal.totalMacros.calories / targetMacros.calories) * 100)}% of target
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">No target set</p>
                    )}
                  </div>
                )}

                {/* PREVIOUS Tab */}
                {activeTab === 'previous' && (
                  <div className="space-y-2">
                    {previousMeal && previousMeal.foods.length > 0 ? (
                      <>
                        <div className="flex items-baseline gap-3">
                          <span className="text-base font-semibold">{Math.round(previousMeal.totalMacros.calories)}</span>
                          <span className="text-xs text-[var(--color-muted)]">cal</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                            {Math.round(previousMeal.totalMacros.protein)}g P
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                            {Math.round(previousMeal.totalMacros.carbs)}g C
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-line)] font-medium">
                            {Math.round(previousMeal.totalMacros.fat)}g F
                          </span>
                        </div>
                        {/* Previous foods list */}
                        <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
                          <p className="text-[10px] text-[var(--color-muted)] uppercase mb-1">Foods</p>
                          {previousMeal.foods.slice(0, 5).map((food, idx) => (
                            <p key={idx} className="text-xs text-[var(--color-muted)]">
                              {food.name} ({Math.round(food.macros.calories)} cal)
                            </p>
                          ))}
                          {previousMeal.foods.length > 5 && (
                            <p className="text-xs text-[var(--color-muted)]">
                              +{previousMeal.foods.length - 5} more
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">No previous data</p>
                    )}
                  </div>
                )}
              </div>
            </div>

          {/* Delete meal button - outside tabs */}
          {editable && (
            <div className="ml-6 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteMeal?.(); }}
                className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                delete meal
              </button>
            </div>
          )}
        </>
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
