'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Check } from 'lucide-react';
import { useDietGoalsStore, useDietGoalProfile } from '@/store/diet-goals.store';
import { useHydrated } from '@/hooks/useHydrated';
import { DietGoalChat } from '@/components/diet-goals';
import { BackButton } from '@/components/ui/BackButton';
import { EditableNumber, EditableSelect, EditableText } from '@/components/ui/EditableField';
import { getDietGoalContext } from '@/server/actions/diet-goal.actions';
import { calculateTDEE, toKg, toCm, recalculateTargets } from '@/lib/diet/plan-utils';
import type { DietGoalProfile, ActivityLevel, DietGoal, DietStyle } from '@/lib/sessions/types';
import type { DietGoalContext } from '@/server/actions/diet-goal.actions';

const activityOptions: { value: string; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderately_active', label: 'Moderate' },
  { value: 'very_active', label: 'Very Active' },
  { value: 'extremely_active', label: 'Extremely Active' },
];

const genderOptions: { value: string; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const goalOptions: { value: string; label: string }[] = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'body_recomp', label: 'Body Recomp' },
  { value: 'performance', label: 'Performance' },
  { value: 'health', label: 'Health' },
];

const styleOptions: { value: string; label: string }[] = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'high_protein', label: 'High Protein' },
  { value: 'low_carb', label: 'Low Carb' },
  { value: 'keto', label: 'Keto' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high_carb', label: 'High Carb' },
];

const weightUnitOptions: { value: string; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lbs', label: 'lbs' },
];

const heightUnitOptions: { value: string; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'ft', label: 'ft' },
];

// ============================================================================
// INLINE-EDITABLE PROFILE VIEW
// ============================================================================

function ProfileView({
  profile,
  onSave,
  onClear,
}: {
  profile: DietGoalProfile;
  onSave: (updated: DietGoalProfile) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<DietGoalProfile>(profile);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Sync draft when profile changes externally
  useEffect(() => { setDraft(profile); }, [profile]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(profile),
    [draft, profile],
  );

  // Recalculate TDEE + redistribute macros preserving deficit
  const updateBodyStat = useCallback((partial: Partial<DietGoalProfile>) => {
    setDraft(prev => {
      const next = { ...prev, ...partial };
      const weightKg = toKg(next.weight, next.weightUnit);
      const heightCm = toCm(next.height, next.heightUnit);
      const oldTdee = prev.tdee;
      const newTdee = calculateTDEE(weightKg, heightCm, next.age, next.gender, next.activityLevel);
      const deficit = oldTdee - prev.targets.calories;
      const newCalories = Math.max(0, newTdee - deficit);

      const result = recalculateTargets(prev.targets, 'calories', newCalories, weightKg, next.gender);
      setWarnings(result.warnings);

      return {
        ...next,
        tdee: newTdee,
        targets: result.targets,
        proteinPerKg: result.proteinPerKg,
      };
    });
  }, []);

  // Direct macro edit
  const handleMacroEdit = useCallback((field: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber', value: number) => {
    setDraft(prev => {
      const weightKg = toKg(prev.weight, prev.weightUnit);
      const result = recalculateTargets(prev.targets, field, value, weightKg, prev.gender);
      setWarnings(result.warnings);
      return { ...prev, targets: result.targets, proteinPerKg: result.proteinPerKg };
    });
  }, []);

  const handleSave = useCallback(() => {
    const now = new Date().toISOString();
    const newProfile: DietGoalProfile = {
      ...draft,
      createdAt: now,
      updatedAt: now,
    };
    onSave(newProfile);
    setWarnings([]);
  }, [draft, onSave]);

  const carbPct = draft.targets.calories > 0 ? Math.round(draft.targets.carbs * 4 / draft.targets.calories * 100) : 0;
  const fatPct = draft.targets.calories > 0 ? Math.round(draft.targets.fat * 9 / draft.targets.calories * 100) : 0;
  const editStyle = 'text-sm text-[var(--color-text)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50';

  return (
    <div className="space-y-4">
      {/* TDEE + Target */}
      <div className="p-4 border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Daily Target</span>
          <div className="flex gap-2">
            <button
              onClick={onClear}
              className="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors"
              aria-label="Clear goals"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <EditableNumber
            value={draft.targets.calories}
            onConfirm={(v) => handleMacroEdit('calories', v)}
            className="text-3xl font-medium text-[var(--color-lime)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/40 cursor-pointer"
            inputClassName="w-20 text-3xl font-medium text-[var(--color-lime)] bg-transparent border-b border-[var(--color-lime)] outline-none"
          />
          <span className="text-sm text-[var(--color-muted)]">cal/day</span>
        </div>
        <div className="text-xs text-[var(--color-muted)]">
          TDEE: {draft.tdee} cal ·{' '}
          <EditableSelect value={draft.dietGoal} options={goalOptions} onConfirm={(v) => setDraft(d => ({ ...d, dietGoal: v as DietGoal }))} className={editStyle} />
          {draft.targets.calories < draft.tdee && ` (−${draft.tdee - draft.targets.calories} deficit)`}
          {draft.targets.calories > draft.tdee && ` (+${draft.targets.calories - draft.tdee} surplus)`}
        </div>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 border border-[var(--color-line)] text-center">
          <div className="text-[10px] text-[var(--color-muted)] uppercase">Protein</div>
          <div className="flex items-center justify-center gap-0.5">
            <EditableNumber
              value={draft.targets.protein}
              onConfirm={(v) => handleMacroEdit('protein', v)}
              className="text-lg font-medium text-[var(--color-text)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50 cursor-pointer"
              inputClassName="w-14 text-center text-lg font-medium bg-transparent border-b border-[var(--color-lime)] outline-none text-[var(--color-text)]"
            />
            <span className="text-sm text-[var(--color-muted)]">g</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">{draft.proteinPerKg}g/kg</div>
        </div>
        <div className="p-3 border border-[var(--color-line)] text-center">
          <div className="text-[10px] text-[var(--color-muted)] uppercase">Carbs</div>
          <div className="flex items-center justify-center gap-0.5">
            <EditableNumber
              value={draft.targets.carbs}
              onConfirm={(v) => handleMacroEdit('carbs', v)}
              className="text-lg font-medium text-[var(--color-text)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50 cursor-pointer"
              inputClassName="w-14 text-center text-lg font-medium bg-transparent border-b border-[var(--color-lime)] outline-none text-[var(--color-text)]"
            />
            <span className="text-sm text-[var(--color-muted)]">g</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">{carbPct}%</div>
        </div>
        <div className="p-3 border border-[var(--color-line)] text-center">
          <div className="text-[10px] text-[var(--color-muted)] uppercase">Fat</div>
          <div className="flex items-center justify-center gap-0.5">
            <EditableNumber
              value={draft.targets.fat}
              onConfirm={(v) => handleMacroEdit('fat', v)}
              className="text-lg font-medium text-[var(--color-text)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50 cursor-pointer"
              inputClassName="w-14 text-center text-lg font-medium bg-transparent border-b border-[var(--color-lime)] outline-none text-[var(--color-text)]"
            />
            <span className="text-sm text-[var(--color-muted)]">g</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">{fatPct}%</div>
        </div>
      </div>

      {/* Fiber */}
      <div className="flex items-center gap-2 px-3 text-xs text-[var(--color-muted)]">
        <span>Fiber:</span>
        <EditableNumber value={draft.targets.fiber ?? 25} onConfirm={(v) => handleMacroEdit('fiber', v)} />
        <span>g</span>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1 px-3">
          {warnings.map((w, i) => (
            <div key={i} className="text-[11px] text-[var(--color-warning,#f59e0b)] flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Body Stats */}
      <div className="space-y-2">
        <div className="px-3 py-2 border border-[var(--color-line)]">
          <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Body Stats</span>
          <div className="flex items-center gap-1 text-sm text-[var(--color-text)] flex-wrap">
            <EditableNumber value={draft.weight} onConfirm={(v) => updateBodyStat({ weight: v })} className={editStyle} />
            <EditableSelect value={draft.weightUnit} options={weightUnitOptions} onConfirm={(v) => updateBodyStat({ weightUnit: v as 'kg' | 'lbs' })} className={'text-xs ' + editStyle} />
            <span className="text-[var(--color-muted)]">·</span>
            <EditableNumber value={draft.height} onConfirm={(v) => updateBodyStat({ height: v })} className={editStyle} />
            <EditableSelect value={draft.heightUnit} options={heightUnitOptions} onConfirm={(v) => updateBodyStat({ heightUnit: v as 'cm' | 'ft' })} className={'text-xs ' + editStyle} />
            <span className="text-[var(--color-muted)]">·</span>
            <EditableNumber value={draft.age} onConfirm={(v) => updateBodyStat({ age: v })} className={editStyle} />
            <span className="text-xs text-[var(--color-muted)]">y</span>
            <span className="text-[var(--color-muted)]">·</span>
            <EditableSelect value={draft.gender} options={genderOptions} onConfirm={(v) => updateBodyStat({ gender: v as 'male' | 'female' | 'other' })} className={editStyle} />
            {draft.bodyFatPercent != null && (
              <>
                <span className="text-[var(--color-muted)]">·</span>
                <EditableNumber value={draft.bodyFatPercent} onConfirm={(v) => setDraft(d => ({ ...d, bodyFatPercent: v }))} className={editStyle} />
                <span className="text-xs text-[var(--color-muted)]">% bf</span>
              </>
            )}
          </div>
        </div>
        <div className="px-3 py-2 border border-[var(--color-line)]">
          <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Activity</span>
          <div className="flex items-center gap-1 text-sm text-[var(--color-text)]">
            <EditableSelect value={draft.activityLevel} options={activityOptions} onConfirm={(v) => updateBodyStat({ activityLevel: v as ActivityLevel })} className={editStyle} />
            <span className="text-[var(--color-muted)]">·</span>
            <EditableNumber value={draft.trainingDaysPerWeek} onConfirm={(v) => setDraft(d => ({ ...d, trainingDaysPerWeek: v }))} className={editStyle} />
            <span className="text-xs text-[var(--color-muted)]">days/wk</span>
          </div>
        </div>
        <div className="px-3 py-2 border border-[var(--color-line)]">
          <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Style</span>
          <div className="flex items-center gap-1 text-sm text-[var(--color-text)]">
            <EditableSelect value={draft.dietStyle} options={styleOptions} onConfirm={(v) => setDraft(d => ({ ...d, dietStyle: v as DietStyle }))} className={editStyle} />
            {draft.mealsPerDay != null && (
              <>
                <span className="text-[var(--color-muted)]">·</span>
                <EditableNumber value={draft.mealsPerDay} onConfirm={(v) => setDraft(d => ({ ...d, mealsPerDay: v }))} className={editStyle} />
                <span className="text-xs text-[var(--color-muted)]">meals/day</span>
              </>
            )}
          </div>
        </div>
        {(draft.allergies != null || draft.allergies === '') && (
          <div className="px-3 py-2 border border-[var(--color-line)]">
            <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Allergies</span>
            <EditableText value={draft.allergies || ''} onConfirm={(v) => setDraft(d => ({ ...d, allergies: v || undefined }))} placeholder="None" className="text-xs text-[var(--color-muted)] mt-0.5 block border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50" />
          </div>
        )}
        {(draft.foodPreferences != null || draft.foodPreferences === '') && (
          <div className="px-3 py-2 border border-[var(--color-line)]">
            <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Preferences</span>
            <EditableText value={draft.foodPreferences || ''} onConfirm={(v) => setDraft(d => ({ ...d, foodPreferences: v || undefined }))} placeholder="None" className="text-xs text-[var(--color-muted)] mt-0.5 block border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50" />
          </div>
        )}
      </div>

      {/* Save button — visible when dirty */}
      {isDirty && (
        <button
          onClick={handleSave}
          className="w-full py-2.5 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] flex items-center justify-center gap-2 transition-opacity"
        >
          <Check className="w-4 h-4" />
          Save Changes
        </button>
      )}

      <div className="text-[10px] text-[var(--color-muted)]/50 text-center mt-4">
        Updated {new Date(profile.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function DietGoalsPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const profile = useDietGoalProfile();
  const setProfile = useDietGoalsStore((s) => s.setProfile);
  const clearProfile = useDietGoalsStore((s) => s.clearProfile);

  const [context, setContext] = useState<DietGoalContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  // Fetch pre-fill context from server (only needed for initial creation)
  useEffect(() => {
    if (profile) { setLoadingContext(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const ctx = await getDietGoalContext();
        if (!cancelled) setContext(ctx);
      } catch (err) {
        console.error('[DietGoalsPage] Failed to fetch context:', err);
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile]);

  const handleComplete = (newProfile: DietGoalProfile) => {
    setProfile(newProfile);
  };

  const handleClear = () => {
    if (confirm('Clear your diet goals?')) {
      clearProfile();
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <span className="text-sm font-medium text-[var(--color-text)]">Diet Goals</span>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // No profile → show questionnaire for initial creation
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="sticky top-0 z-10 h-12 flex items-center px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
          <span className="text-sm font-medium text-[var(--color-text)]">Set Diet Goals</span>
        </header>
        <main className="flex-1">
          {loadingContext ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
            </div>
          ) : (
            <DietGoalChat
              initialStats={context?.parsedStats}
              inferredActivity={context?.trainingDaysPerWeek ? {
                trainingDaysPerWeek: context.trainingDaysPerWeek,
              } : undefined}
              onComplete={handleComplete}
            />
          )}
        </main>
        <BackButton />
      </div>
    );
  }

  // Has profile → inline-editable view
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        <span className="text-sm font-medium text-[var(--color-text)]">Diet Goals</span>
        <button
          onClick={() => router.push('/diet-stats')}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-lime)] transition-colors"
        >
          Stats
        </button>
      </header>
      <main className="flex-1 px-4 py-4">
        <ProfileView
          profile={profile}
          onSave={setProfile}
          onClear={handleClear}
        />
      </main>
      <BackButton />
    </div>
  );
}
