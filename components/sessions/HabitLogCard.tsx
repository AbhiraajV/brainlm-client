'use client';

import { useState, useCallback } from 'react';
import type { HabitLog, HabitEntry, HabitPolarity, HabitReflection } from '@/lib/sessions/types';
import { useHabitsStore } from '@/store/habits.store';
import { recalculateSummary } from '@/lib/habit/utils';
import { Check, Circle, ChevronDown, ChevronRight, Plus, X, AlertTriangle, Shield, Trash2 } from 'lucide-react';

interface HabitLogCardProps {
  habitLog: HabitLog | undefined;
  editable?: boolean;
  onUpdate?: (habitLog: HabitLog) => void;
  onComplete?: () => void;
}

export function HabitLogCard({ habitLog, editable = false, onUpdate, onComplete }: HabitLogCardProps) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitPolarity, setNewHabitPolarity] = useState<HabitPolarity>('positive');
  const addHabitToStore = useHabitsStore((s) => s.addHabit);
  const deleteHabitFromStore = useHabitsStore((s) => s.deleteHabit);

  const positiveEntries = habitLog?.entries.filter((e) => e.polarity === 'positive') || [];
  const negativeEntries = habitLog?.entries.filter((e) => e.polarity === 'negative') || [];

  const toggleEntry = useCallback(
    (habitId: string) => {
      if (!habitLog || !editable || !onUpdate) return;

      const updatedEntries = habitLog.entries.map((e) => {
        if (e.habitId !== habitId) return e;
        const newStatus = e.status === 'done' ? 'pending' : 'done';
        return {
          ...e,
          status: newStatus as 'pending' | 'done' | 'skipped',
          checkedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
        };
      });

      onUpdate(recalculateSummary({ ...habitLog, entries: updatedEntries }));
    },
    [habitLog, editable, onUpdate]
  );

  const addReflection = useCallback(
    (habitId: string, text: string) => {
      if (!habitLog || !editable || !onUpdate || !text.trim()) return;

      const reflection: HabitReflection = {
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedEntries = habitLog.entries.map((e) =>
        e.habitId === habitId
          ? { ...e, reflections: [...(e.reflections || []), reflection] }
          : e
      );

      onUpdate({ ...habitLog, entries: updatedEntries, updatedAt: new Date().toISOString() });
    },
    [habitLog, editable, onUpdate]
  );

  const handleDeleteHabit = useCallback(
    (habitId: string) => {
      if (!habitLog || !onUpdate) return;

      // Remove from persistent store
      deleteHabitFromStore(habitId);

      // Remove from current log
      const updatedEntries = habitLog.entries.filter((e) => e.habitId !== habitId);
      onUpdate(recalculateSummary({ ...habitLog, entries: updatedEntries }));
    },
    [habitLog, onUpdate, deleteHabitFromStore]
  );

  const handleAddHabit = useCallback(() => {
    if (!newHabitName.trim() || !onUpdate) return;

    // Add to persistent store
    const id = addHabitToStore(newHabitName.trim(), newHabitPolarity);

    // Also add to current log
    const newEntry: HabitEntry = {
      habitId: id,
      habitName: newHabitName.trim(),
      polarity: newHabitPolarity,
      status: 'pending',
    };

    // If no habitLog yet, create one from scratch
    const baseLog: HabitLog = habitLog ?? {
      id: `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString().split('T')[0],
      entries: [],
      summary: { totalHabits: 0, totalAntiHabits: 0, completedHabits: 0, failedAntiHabits: 0, skippedCount: 0, completionRate: 0, allPositivesDone: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedLog = recalculateSummary({
      ...baseLog,
      entries: [...baseLog.entries, newEntry],
    });

    onUpdate(updatedLog);
    setNewHabitName('');
    setShowAddHabit(false);
  }, [newHabitName, newHabitPolarity, habitLog, onUpdate, addHabitToStore]);

  if (!habitLog) {
    return (
      <div className="bg-[var(--color-surface)]">
        <div className="flex flex-col items-center justify-center py-12 px-5">
          <Circle className="w-12 h-12 text-[var(--color-line)] mb-4" />
          <p className="font-serif text-lg text-[var(--color-text)]">No habits defined</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Add your first habit to start tracking
          </p>
        </div>

        {/* Add habit form - available even when no log exists */}
        {editable && (
          <div className="px-5 sm:px-7 py-3 border-t border-[var(--color-line)]">
            {showAddHabit ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="Habit name..."
                  className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddHabit();
                    if (e.key === 'Escape') { setShowAddHabit(false); setNewHabitName(''); }
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNewHabitPolarity('positive')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${newHabitPolarity === 'positive' ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}
                  >
                    Positive
                  </button>
                  <button
                    onClick={() => setNewHabitPolarity('negative')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${newHabitPolarity === 'negative' ? 'border-[var(--color-error)] bg-[var(--color-error)]/10 text-[var(--color-error)]' : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}
                  >
                    Anti-Habit
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddHabit}
                    disabled={!newHabitName.trim()}
                    className="flex-1 py-2 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40 transition-opacity"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddHabit(false); setNewHabitName(''); }}
                    className="py-2 px-4 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddHabit(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg)] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add your first habit
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const { summary } = habitLog;

  return (
    <div className="bg-[var(--color-surface)]">
      {/* Summary bar */}
      <div className="px-5 sm:px-7 py-3 border-b border-[var(--color-line)]">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
            <span className="font-medium">{summary.completedHabits}/{summary.totalHabits}</span>
            <span className="text-[var(--color-muted)]">done</span>
          </span>
          {summary.totalAntiHabits > 0 && (
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[var(--color-error)]" />
              <span className="font-medium">{summary.failedAntiHabits}/{summary.totalAntiHabits}</span>
              <span className="text-[var(--color-muted)]">slipped</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <span
              className={`
                font-semibold text-sm
                ${summary.completionRate >= 80
                  ? 'text-[var(--color-success)]'
                  : summary.completionRate >= 50
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-muted)]'
                }
              `}
            >
              {summary.completionRate}%
            </span>
          </span>
        </div>
      </div>

      {/* Positive habits section */}
      {positiveEntries.length > 0 && (
        <div>
          <div className="px-5 sm:px-7 py-2 bg-[var(--color-bg)] border-b border-[var(--color-line)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">Habits</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-line)] text-[var(--color-muted)]">
                {positiveEntries.length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-[var(--color-line)]">
            {positiveEntries.map((entry) => (
              <HabitRow
                key={entry.habitId}
                entry={entry}
                editable={editable}
                isExpanded={expandedEntry === entry.habitId}
                onToggle={() => toggleEntry(entry.habitId)}
                onExpand={() =>
                  setExpandedEntry(expandedEntry === entry.habitId ? null : entry.habitId)
                }
                onAddReflection={(text) => addReflection(entry.habitId, text)}
                onDelete={() => handleDeleteHabit(entry.habitId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Anti-habits section */}
      {negativeEntries.length > 0 && (
        <div>
          <div className="px-5 sm:px-7 py-2 bg-[var(--color-bg)] border-b border-[var(--color-line)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">Anti-Habits</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-line)] text-[var(--color-muted)]">
                {negativeEntries.length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-[var(--color-line)]">
            {negativeEntries.map((entry) => (
              <AntiHabitRow
                key={entry.habitId}
                entry={entry}
                editable={editable}
                isExpanded={expandedEntry === entry.habitId}
                onToggle={() => toggleEntry(entry.habitId)}
                onExpand={() =>
                  setExpandedEntry(expandedEntry === entry.habitId ? null : entry.habitId)
                }
                onAddReflection={(text) => addReflection(entry.habitId, text)}
                onDelete={() => handleDeleteHabit(entry.habitId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add habit/anti-habit */}
      {editable && (
        <div className="px-5 sm:px-7 py-3 border-t border-[var(--color-line)]">
          {showAddHabit ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="Habit name..."
                  className="flex-1 bg-[var(--color-bg)] border border-[var(--color-line)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddHabit();
                    if (e.key === 'Escape') {
                      setShowAddHabit(false);
                      setNewHabitName('');
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNewHabitPolarity('positive')}
                  className={`
                    flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors
                    ${newHabitPolarity === 'positive'
                      ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                      : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-success)]/50'
                    }
                  `}
                >
                  Positive
                </button>
                <button
                  onClick={() => setNewHabitPolarity('negative')}
                  className={`
                    flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors
                    ${newHabitPolarity === 'negative'
                      ? 'border-[var(--color-error)] bg-[var(--color-error)]/10 text-[var(--color-error)]'
                      : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-error)]/50'
                    }
                  `}
                >
                  Anti-Habit
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddHabit}
                  disabled={!newHabitName.trim()}
                  className="flex-1 py-2 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40 transition-opacity"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddHabit(false);
                    setNewHabitName('');
                  }}
                  className="py-2 px-4 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddHabit(true)}
              className="flex items-center gap-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add habit
            </button>
          )}
        </div>
      )}

      {/* Completion prompt */}
      {editable && summary.allPositivesDone && summary.totalHabits > 0 && onComplete && (
        <div className="px-5 sm:px-7 py-4 border-t border-[var(--color-success)]/30 bg-[var(--color-success)]/5">
          <p className="text-sm text-[var(--color-success)] font-medium mb-2">
            All habits checked! Save today&apos;s progress?
          </p>
          <button
            onClick={onComplete}
            className="
              w-full py-2.5 text-sm font-medium rounded-lg
              bg-[var(--color-success)] text-white
              hover:opacity-90 transition-opacity
              active:scale-[0.98]
            "
          >
            Save &amp; Complete
          </button>
        </div>
      )}
    </div>
  );
}

// Helper: get all reflections (merge legacy comment + reflections array)
function getReflections(entry: HabitEntry): HabitReflection[] {
  const reflections = entry.reflections || [];
  // If legacy comment exists and no reflections, show it as a legacy entry
  if (entry.comment && reflections.length === 0) {
    return [{ text: entry.comment, createdAt: entry.checkedAt || '' }];
  }
  return reflections;
}

// Helper: format reflection timestamp
function formatReflectionTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Reflections display + input shared by both row types
function ReflectionsArea({
  entry,
  editable,
  onAddReflection,
  placeholder,
}: {
  entry: HabitEntry;
  editable: boolean;
  onAddReflection: (text: string) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const reflections = getReflections(entry);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    onAddReflection(inputValue);
    setInputValue('');
  };

  return (
    <div className="px-5 sm:px-7 pb-3 pl-14 sm:pl-16">
      {/* Existing reflections list */}
      {reflections.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {reflections.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              {r.createdAt && (
                <span className="text-[10px] text-[var(--color-muted)] whitespace-nowrap mt-0.5 min-w-[5rem]">
                  {formatReflectionTime(r.createdAt)}
                </span>
              )}
              <p className="text-sm text-[var(--color-muted)] italic">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add reflection input */}
      {editable && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder={placeholder}
          className="
            w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-none
            px-3 py-2 text-sm text-[var(--color-text)]
            placeholder:text-[var(--color-muted)]
            focus:outline-none focus:border-[var(--color-accent)]
          "
        />
      )}

      {!editable && reflections.length === 0 && (
        <p className="text-xs text-[var(--color-muted)]">No reflections</p>
      )}
    </div>
  );
}

// Individual positive habit row
function HabitRow({
  entry,
  editable,
  isExpanded,
  onToggle,
  onExpand,
  onAddReflection,
  onDelete,
}: {
  entry: HabitEntry;
  editable: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onAddReflection: (text: string) => void;
  onDelete: () => void;
}) {
  const isDone = entry.status === 'done';

  return (
    <div>
      <div className="flex items-center gap-3 px-5 sm:px-7 py-3">
        {/* Checkbox */}
        {editable ? (
          <button
            onClick={onToggle}
            className={`
              w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
              ${isDone
                ? 'border-[var(--color-success)] bg-[var(--color-success)]'
                : 'border-[var(--color-line)] hover:border-[var(--color-success)]/50'
              }
            `}
          >
            {isDone && <Check className="w-4 h-4 text-white" />}
          </button>
        ) : (
          <div
            className={`
              w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0
              ${isDone
                ? 'border-[var(--color-success)] bg-[var(--color-success)]'
                : 'border-[var(--color-line)]'
              }
            `}
          >
            {isDone && <Check className="w-4 h-4 text-white" />}
          </div>
        )}

        {/* Name */}
        <span
          className={`
            flex-1 text-sm
            ${isDone ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-text)]'}
          `}
        >
          {entry.habitName}
        </span>

        {/* Delete */}
        {editable && (
          <button
            onClick={onDelete}
            className="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Expand for reflections */}
        <button
          onClick={onExpand}
          className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Reflections area */}
      {isExpanded && (
        <ReflectionsArea
          entry={entry}
          editable={editable}
          onAddReflection={onAddReflection}
          placeholder="Add reflection..."
        />
      )}
    </div>
  );
}

// Individual anti-habit row
function AntiHabitRow({
  entry,
  editable,
  isExpanded,
  onToggle,
  onExpand,
  onAddReflection,
  onDelete,
}: {
  entry: HabitEntry;
  editable: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onAddReflection: (text: string) => void;
  onDelete: () => void;
}) {
  const hasSlipped = entry.status === 'done';

  return (
    <div>
      <div className="flex items-center gap-3 px-5 sm:px-7 py-3">
        {/* Status badge */}
        {hasSlipped ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)] text-[10px] font-medium flex-shrink-0">
            <AlertTriangle className="w-3 h-3" />
            Slipped
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)] text-[10px] font-medium flex-shrink-0">
            <Shield className="w-3 h-3" />
            Clean
          </span>
        )}

        {/* Name */}
        <span className="flex-1 text-sm text-[var(--color-text)]">
          {entry.habitName}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {editable && (
            <>
              <button
                onClick={onToggle}
                className={`
                  text-[10px] px-2 py-1 rounded-lg border transition-colors
                  ${hasSlipped
                    ? 'border-[var(--color-success)]/50 text-[var(--color-success)] hover:bg-[var(--color-success)]/10'
                    : 'border-[var(--color-error)]/50 text-[var(--color-error)] hover:bg-[var(--color-error)]/10'
                  }
                `}
              >
                {hasSlipped ? 'Undo' : 'I slipped'}
              </button>
              <button
                onClick={onDelete}
                className="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onExpand}
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Reflections area */}
      {isExpanded && (
        <ReflectionsArea
          entry={entry}
          editable={editable}
          onAddReflection={onAddReflection}
          placeholder={hasSlipped ? "What happened?" : "Add reflection..."}
        />
      )}
    </div>
  );
}
