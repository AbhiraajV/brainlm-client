'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import type { DietDayPlan, DailyTargets, DietHistoryDay } from '@/lib/sessions/types';

interface DietCoachFirstMessageProps {
  recommendation: DietDayPlan | null; // null = still loading
  weekHistory: DietHistoryDay[];
  profileTargets: DailyTargets;
  alreadyAccepted: boolean;
  onAccept: (targets: DailyTargets) => void;
  onCustomTargets: (targets: DailyTargets) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_NAMES[d.getDay()] ?? dateStr.slice(5);
}

export function DietCoachFirstMessage({
  recommendation,
  weekHistory,
  profileTargets,
  alreadyAccepted,
  onAccept,
  onCustomTargets,
}: DietCoachFirstMessageProps) {
  // 'pending' | 'accepted' | 'adjusting' | 'confirmed'
  const [state, setState] = useState<'pending' | 'accepted' | 'adjusting' | 'confirmed'>(
    alreadyAccepted ? 'accepted' : 'pending'
  );

  // Manual edit values (prepopulated with profile defaults, NOT AI recommendation)
  const [editCal, setEditCal] = useState(String(profileTargets.calories));
  const [editP, setEditP] = useState(String(profileTargets.protein));
  const [editC, setEditC] = useState(String(profileTargets.carbs));
  const [editF, setEditF] = useState(String(profileTargets.fat));
  const calRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === 'adjusting') calRef.current?.focus();
  }, [state]);

  // Loading state
  if (!recommendation && !alreadyAccepted) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Checking this week&apos;s data...
        </div>
      </div>
    );
  }

  const plan = recommendation;
  const targets = plan?.targets ?? profileTargets;

  const handleAccept = () => {
    setState('accepted');
    onAccept(targets);
  };

  const handleReject = () => {
    // Prepopulate with profile defaults
    setEditCal(String(profileTargets.calories));
    setEditP(String(profileTargets.protein));
    setEditC(String(profileTargets.carbs));
    setEditF(String(profileTargets.fat));
    setState('adjusting');
  };

  const handleConfirmCustom = () => {
    const custom: DailyTargets = {
      calories: parseInt(editCal) || profileTargets.calories,
      protein: parseInt(editP) || profileTargets.protein,
      carbs: parseInt(editC) || profileTargets.carbs,
      fat: parseInt(editF) || profileTargets.fat,
      fiber: profileTargets.fiber,
    };
    setState('confirmed');
    onCustomTargets(custom);
  };

  // Accepted / Confirmed — collapsed view
  if (state === 'accepted' || state === 'confirmed') {
    const finalTargets = state === 'accepted' ? targets : {
      calories: parseInt(editCal) || profileTargets.calories,
      protein: parseInt(editP) || profileTargets.protein,
      carbs: parseInt(editC) || profileTargets.carbs,
      fat: parseInt(editF) || profileTargets.fat,
    };
    return (
      <div className="px-4 py-3 border-b border-[var(--color-line)]">
        <div className="text-[13px] text-[var(--color-text)]">
          <span className="text-[var(--color-lime)] font-medium">{finalTargets.calories}</span>
          <span className="text-[var(--color-muted)]"> cal</span>
          <span className="text-[var(--color-muted)] mx-1.5">·</span>
          <span className="font-medium">{finalTargets.protein}</span>
          <span className="text-[var(--color-muted)]">g P</span>
          <span className="text-[var(--color-muted)] mx-1.5">·</span>
          <span className="font-medium">{finalTargets.carbs}</span>
          <span className="text-[var(--color-muted)]">g C</span>
          <span className="text-[var(--color-muted)] mx-1.5">·</span>
          <span className="font-medium">{finalTargets.fat}</span>
          <span className="text-[var(--color-muted)]">g F</span>
        </div>
        {plan?.reasoning && state === 'accepted' && (
          <div className="text-[11px] text-[var(--color-muted)] mt-1">{plan.reasoning}</div>
        )}
      </div>
    );
  }

  // Adjusting — manual input boxes
  if (state === 'adjusting') {
    return (
      <div className="px-4 py-3 border-b border-[var(--color-line)] space-y-3">
        <div className="text-[11px] text-[var(--color-muted)] uppercase tracking-wider">Set today&apos;s targets</div>
        <div className="grid grid-cols-4 gap-2">
          {([
            { label: 'Cal', value: editCal, set: setEditCal, ref: calRef },
            { label: 'P', value: editP, set: setEditP, ref: null },
            { label: 'C', value: editC, set: setEditC, ref: null },
            { label: 'F', value: editF, set: setEditF, ref: null },
          ] as const).map(({ label, value, set, ref }) => (
            <div key={label}>
              <div className="text-[9px] text-[var(--color-muted)] uppercase mb-0.5">{label}</div>
              <input
                ref={ref}
                type="number"
                value={value}
                onChange={(e) => set(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmCustom(); }}
                className="w-full px-2 py-1.5 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)] text-center"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleConfirmCustom}
          className="w-full py-2 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          Confirm
        </button>
      </div>
    );
  }

  // Pending — show recommendation with accept/reject
  return (
    <div className="px-4 py-3 border-b border-[var(--color-line)] space-y-2.5">
      {/* Week history mini row */}
      {weekHistory.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {weekHistory.slice(0, 7).map(day => (
            <div key={day.date} className="text-center flex-shrink-0">
              <div className="text-[9px] text-[var(--color-muted)] uppercase">{shortDay(day.date)}</div>
              <div className="text-[12px] font-medium text-[var(--color-text)]">{day.totalCalories}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recommended targets */}
      <div className="text-[13px] text-[var(--color-text)]">
        <span className="text-[var(--color-lime)] font-medium text-base">{targets.calories}</span>
        <span className="text-[var(--color-muted)] text-xs"> cal</span>
        <span className="text-[var(--color-muted)] mx-1.5">·</span>
        <span className="font-medium">{targets.protein}</span>
        <span className="text-[var(--color-muted)] text-xs">g P</span>
        <span className="text-[var(--color-muted)] mx-1.5">·</span>
        <span className="font-medium">{targets.carbs}</span>
        <span className="text-[var(--color-muted)] text-xs">g C</span>
        <span className="text-[var(--color-muted)] mx-1.5">·</span>
        <span className="font-medium">{targets.fat}</span>
        <span className="text-[var(--color-muted)] text-xs">g F</span>
      </div>

      {/* Reasoning */}
      {plan?.reasoning && plan.reasoning !== 'Using your default targets.' && (
        <div className="text-[11px] text-[var(--color-muted)] leading-relaxed">
          {plan.reasoning}
        </div>
      )}

      {/* Accept / Reject buttons */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={handleAccept}
          className="flex-1 py-2 text-sm border border-[var(--color-lime)]/40 text-[var(--color-lime)] hover:bg-[var(--color-lime)]/10 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleReject}
          className="flex-1 py-2 text-sm border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)] flex items-center justify-center gap-1.5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
