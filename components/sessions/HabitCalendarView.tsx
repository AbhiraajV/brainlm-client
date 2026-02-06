'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useHabitHistory } from '@/hooks/useHabitHistory';
import { useHabitsStore } from '@/store/habits.store';
import { calculateStreak } from '@/lib/habit/utils';
import type { HabitHistoryDay } from '@/server/actions/habit-history.actions';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getMonthBounds(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    daysInMonth: end.getDate(),
    // Monday=0, Sunday=6
    startDayOfWeek: (start.getDay() + 6) % 7,
  };
}

function getDayStatus(day: HabitHistoryDay | undefined): 'none' | 'success' | 'partial' | 'failed' {
  if (!day?.habitLog?.entries?.length) return 'none';

  const entries = day.habitLog.entries;
  const positives = entries.filter((e) => e.polarity === 'positive');
  const negatives = entries.filter((e) => e.polarity === 'negative');

  const allPositivesDone = positives.length > 0 && positives.every((e) => e.status === 'done');
  const noAntiSlips = negatives.every((e) => e.status !== 'done');
  const hasFailures = negatives.some((e) => e.status === 'done');

  if (allPositivesDone && noAntiSlips) return 'success';
  if (hasFailures) return 'failed';
  return 'partial';
}

const statusColors = {
  none: 'bg-[var(--color-line)]/30',
  success: 'bg-[var(--color-success)]',
  partial: 'bg-[var(--color-warning)]',
  failed: 'bg-[var(--color-error)]',
};

export function HabitCalendarView() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const allHabits = useHabitsStore((s) => s.habits);
  const activeHabits = useMemo(
    () => allHabits.filter((h) => !h.isArchived).sort((a, b) => a.orderIndex - b.orderIndex),
    [allHabits]
  );

  const { startDate, endDate, daysInMonth, startDayOfWeek } = useMemo(
    () => getMonthBounds(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // Fetch 90 days for streaks, filtered to current month for calendar
  const threeMonthsAgo = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  }, [viewYear, viewMonth]);

  const { days, isLoading } = useHabitHistory(threeMonthsAgo, endDate);

  const daysByDate = useMemo(() => {
    const map = new Map<string, HabitHistoryDay>();
    for (const day of days) {
      map.set(day.date, day);
    }
    return map;
  }, [days]);

  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long' });

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDate(null);
  };

  // Build calendar grid cells
  const cells: (string | null)[] = [];
  // Leading empty cells
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(dateStr);
  }

  // Streaks computation
  const streakData = useMemo(() => {
    if (activeHabits.length === 0 || days.length === 0) return [];

    return activeHabits.map((habit) => {
      const historyForStreak = days
        .filter((d) => d.habitLog?.entries?.length)
        .map((d) => ({
          date: d.date,
          entries: d.habitLog.entries.map((e) => ({
            habitId: e.habitId,
            status: e.status,
            polarity: e.polarity,
          })),
        }));

      const { current, best } = calculateStreak(historyForStreak, habit.id);
      return { habit, current, best };
    });
  }, [activeHabits, days]);

  const selectedDayData = selectedDate ? daysByDate.get(selectedDate) : null;

  return (
    <div className="bg-[var(--color-surface)]">
      {/* Month selector */}
      <div className="flex items-center justify-between px-5 sm:px-7 py-3 border-b border-[var(--color-line)]">
        <button
          onClick={goToPreviousMonth}
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--color-muted)]" />
        </button>
        <span className="font-serif font-medium text-[var(--color-text)]">
          {monthName} {viewYear}
        </span>
        <button
          onClick={goToNextMonth}
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-[var(--color-muted)]" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading history...
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="px-5 sm:px-7 py-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_LABELS.map((label, i) => (
                <div key={i} className="text-center text-[10px] text-[var(--color-muted)] font-medium">
                  {label}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((dateStr, i) => {
                if (!dateStr) {
                  return <div key={`empty-${i}`} className="aspect-square" />;
                }

                const dayNum = parseInt(dateStr.split('-')[2], 10);
                const dayData = daysByDate.get(dateStr);
                const status = getDayStatus(dayData);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === now.toISOString().split('T')[0];

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`
                      aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5
                      transition-all text-xs
                      ${isSelected
                        ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-bg)]'
                        : 'hover:bg-[var(--color-bg)]'
                      }
                      ${isToday ? 'font-bold' : ''}
                    `}
                  >
                    <span className={`${isToday ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
                      {dayNum}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDate && (
            <div className="px-5 sm:px-7 pb-4 border-t border-[var(--color-line)]">
              <div className="pt-3 pb-1">
                <span className="text-xs font-medium text-[var(--color-muted)]">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {selectedDayData?.habitLog?.entries?.length ? (
                <div className="space-y-1 mt-2">
                  {selectedDayData.habitLog.entries.map((entry, i) => {
                    const isPositive = entry.polarity === 'positive';
                    const success = isPositive
                      ? entry.status === 'done'
                      : entry.status !== 'done';

                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            success ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'
                          }`}
                        />
                        <span className="text-[var(--color-text)]">{entry.habitName}</span>
                        <span className="text-[10px] text-[var(--color-muted)]">
                          {isPositive
                            ? entry.status === 'done'
                              ? 'Done'
                              : 'Missed'
                            : entry.status === 'done'
                            ? 'Slipped'
                            : 'Clean'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-muted)] mt-2">No data for this day</p>
              )}
            </div>
          )}

          {/* Streak rows */}
          {streakData.length > 0 && (
            <div className="border-t border-[var(--color-line)]">
              <div className="px-5 sm:px-7 py-2 bg-[var(--color-bg)]">
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">Streaks</span>
              </div>
              <div className="divide-y divide-[var(--color-line)]">
                {streakData.map(({ habit, current, best }) => (
                  <div key={habit.id} className="flex items-center gap-3 px-5 sm:px-7 py-2.5">
                    <span className="text-sm text-[var(--color-text)] flex-1 truncate">{habit.name}</span>
                    {/* Mini streak grid - last 14 days */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: 14 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (13 - i));
                        const dateStr = d.toISOString().split('T')[0];
                        const dayData = daysByDate.get(dateStr);
                        const entry = dayData?.habitLog?.entries?.find((e) => e.habitId === habit.id);

                        let color = 'bg-[var(--color-line)]/30';
                        if (entry) {
                          const success =
                            habit.polarity === 'positive'
                              ? entry.status === 'done'
                              : entry.status !== 'done';
                          color = success ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]';
                        }

                        return (
                          <div
                            key={dateStr}
                            className={`w-2.5 h-2.5 rounded-sm ${color}`}
                            title={dateStr}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs text-[var(--color-muted)] whitespace-nowrap min-w-[4rem] text-right">
                      {current > 0 ? `${current}d streak` : 'No streak'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {days.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 px-5">
              <p className="text-sm text-[var(--color-muted)]">No habit history yet</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">Complete your first day to see data here</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
