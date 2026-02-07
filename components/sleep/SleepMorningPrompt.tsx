'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Moon, X } from 'lucide-react';
import { useSleepStore } from '@/store/sleep.store';
import { saveSleepEvent } from '@/server/actions/sleep.actions';

export function SleepMorningPrompt() {
  const shouldShow = useSleepStore((s) => s.shouldShowMorningPrompt);
  const markShown = useSleepStore((s) => s.markMorningPromptShown);

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Delay before showing to let page settle
    const timer = setTimeout(() => {
      if (shouldShow()) {
        setVisible(true);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [shouldShow]);

  const dismiss = () => {
    setVisible(false);
    markShown();
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    startTransition(async () => {
      await saveSleepEvent({
        content: text.trim(),
        eventType: 'morning',
        occurredAt: new Date(),
      });
      dismiss();
    });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-2xl border border-[var(--color-line)] shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-bg)] transition-colors"
        >
          <X className="w-4 h-4 text-[var(--color-muted)]" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-4" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }}>
          <Moon className="w-6 h-6" style={{ color: '#6366f1' }} />
        </div>

        {/* Prompt */}
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
          Good morning!
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          How did you sleep last night? Share anything about when you woke up, sleep quality, dreams, or how you feel this morning.
        </p>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Slept well, woke up at 7am feeling rested..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-line)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] resize-none focus:outline-none focus:border-[#6366f1] transition-colors"
          autoFocus
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isPending}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: '#6366f1' }}
        >
          {isPending ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
