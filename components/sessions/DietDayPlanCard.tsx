'use client';

import { useState } from 'react';
import { Pencil, Check, X, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import type { DietDayPlan, DailyTargets } from '@/lib/sessions/types';

interface DietDayPlanCardProps {
  plan: DietDayPlan;
  onUpdate: (newTargets: DailyTargets) => void;
}

interface EditingMacro {
  field: keyof DailyTargets;
  value: string;
}

export function DietDayPlanCard({ plan, onUpdate }: DietDayPlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editing, setEditing] = useState<EditingMacro | null>(null);

  const handleEdit = (field: keyof DailyTargets) => {
    const current = plan.targets[field];
    setEditing({ field, value: String(current ?? 0) });
  };

  const handleSave = () => {
    if (!editing) return;
    const num = Math.round(parseFloat(editing.value) || 0);
    if (num <= 0) {
      setEditing(null);
      return;
    }
    const newTargets: DailyTargets = {
      ...plan.targets,
      [editing.field]: num,
    };
    onUpdate(newTargets);
    setEditing(null);
  };

  const handleCancel = () => setEditing(null);

  const macros: { field: keyof DailyTargets; label: string; unit: string; color: string }[] = [
    { field: 'calories', label: 'Cal', unit: '', color: 'text-[var(--color-lime)]' },
    { field: 'protein', label: 'P', unit: 'g', color: 'text-[var(--color-coral)]' },
    { field: 'carbs', label: 'C', unit: 'g', color: 'text-[var(--color-mint)]' },
    { field: 'fat', label: 'F', unit: 'g', color: 'text-[var(--color-muted)]' },
  ];

  return (
    <div className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]" />
        )}
        <Sparkles className="w-3.5 h-3.5 text-[var(--color-lime)]" />
        <span className="text-[11px] font-medium text-[var(--color-text)] uppercase tracking-wider">
          Today&apos;s Plan
        </span>
        {!isExpanded && (
          <span className="text-[11px] text-[var(--color-muted)] ml-auto">
            {plan.targets.calories} cal · {plan.targets.protein}g P
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2.5">
          {/* Macro targets row */}
          <div className="flex gap-2">
            {macros.map(({ field, label, unit, color }) => {
              const isEditing = editing?.field === field;
              const value = plan.targets[field] ?? 0;

              return (
                <div key={field} className="flex-1 min-w-0">
                  <div className="text-[9px] text-[var(--color-muted)] uppercase tracking-wider mb-0.5">
                    {label}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave();
                          if (e.key === 'Escape') handleCancel();
                        }}
                        autoFocus
                        className="w-full px-1.5 py-0.5 text-sm bg-transparent border border-[var(--color-lime)]/30 focus:outline-none focus:border-[var(--color-lime)]/50 text-[var(--color-text)]"
                      />
                      <button onClick={handleSave} className="text-[var(--color-lime)] p-0.5">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={handleCancel} className="text-[var(--color-muted)] p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(field)}
                      className={`flex items-center gap-1 group ${color}`}
                    >
                      <span className="text-sm font-medium">{value}{unit}</span>
                      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </button>
                  )}
                </div>
              );
            })}
            {/* Fiber */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-[var(--color-muted)] uppercase tracking-wider mb-0.5">
                Fiber
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">{plan.fiberTarget}g</span>
            </div>
          </div>

          {/* Reasoning */}
          {plan.reasoning && (
            <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
              {plan.reasoning}
            </p>
          )}

          {/* Adjustments */}
          {plan.adjustments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {plan.adjustments.map((adj, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 bg-[var(--color-lime)]/10 text-[var(--color-lime)] border border-[var(--color-lime)]/20"
                >
                  {adj}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
