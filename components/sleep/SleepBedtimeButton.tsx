'use client';

import { useState, useEffect, useTransition } from 'react';
import { Moon, X } from 'lucide-react';
import { useSleepStore } from '@/store/sleep.store';
import { saveSleepEvent } from '@/server/actions/sleep.actions';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function SleepBedtimeButton() {
  const shouldShow = useSleepStore((s) => s.shouldShowBedtimeButton);
  const markRecorded = useSleepStore((s) => s.markBedtimeEventRecorded);

  const [visible, setVisible] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();

  // Check visibility on mount and every 60s
  useEffect(() => {
    const check = () => setVisible(shouldShow());
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [shouldShow]);

  const handleSubmit = (skip: boolean) => {
    const now = new Date();
    const timeStr = formatTime(now);
    const content = skip
      ? `Going to sleep at ${timeStr}.`
      : `[Going to sleep at ${timeStr}] ${text.trim()}`;

    startTransition(async () => {
      await saveSleepEvent({
        content,
        eventType: 'bedtime',
        occurredAt: now,
      });
      markRecorded();
      setPopupOpen(false);
      setVisible(false);
      setText('');
    });
  };

  if (!visible) return null;

  return (
    <>
      {/* Pill button — positioned above GoToSessionsButton (bottom: 120px) */}
      <button
        onClick={() => setPopupOpen(true)}
        className="
          fixed left-4 z-30
          flex items-center gap-2
          px-3 py-2
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
          text-sm
          shadow-lg
          transition-all duration-200
          hover:border-[#6366f1]/50
          hover:shadow-[#6366f1]/10
          active:scale-95
        "
        style={{ bottom: '170px', color: '#6366f1' }}
        aria-label="Log bedtime"
      >
        <Moon className="w-4 h-4" />
        <span className="font-medium">Sleep</span>
      </button>

      {/* Popup */}
      {popupOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPopupOpen(false)} />

          {/* Card */}
          <div className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-2xl border border-[var(--color-line)] shadow-2xl p-5 mb-4 sm:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Close */}
            <button
              onClick={() => setPopupOpen(false)}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-bg)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--color-muted)]" />
            </button>

            {/* Icon + prompt */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }}>
                <Moon className="w-5 h-5" style={{ color: '#6366f1' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">Bedtime</h3>
                <p className="text-xs text-[var(--color-muted)]">Anything on your mind before you drift off?</p>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Feeling tired, had a long day..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-line)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] resize-none focus:outline-none focus:border-[#6366f1] transition-colors"
              autoFocus
            />

            {/* Buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium border border-[var(--color-line)] text-[var(--color-muted)] hover:bg-[var(--color-bg)] transition-colors disabled:opacity-40"
              >
                {isPending ? 'Saving...' : 'Skip'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={!text.trim() || isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
                style={{ backgroundColor: '#6366f1' }}
              >
                {isPending ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
