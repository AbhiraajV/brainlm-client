'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

export function HelpModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 300);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Help button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="
          flex-shrink-0
          w-8 h-8
          flex items-center justify-center
          rounded-full
          text-[var(--color-muted)]
          hover:text-[var(--color-text)]
          hover:bg-[var(--color-bg)]
          transition-all duration-200
        "
        aria-label="What can I log?"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Full screen modal */}
      {isOpen && (
        <div
          className={`
            fixed inset-0 z-50
            bg-[var(--color-surface)]
            flex flex-col
            ${isClosing ? 'fullscreen-reader-exit' : 'fullscreen-reader-enter'}
          `}
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
            <h2 className="font-serif text-xl font-semibold text-[var(--color-text)]">
              What can I log? 🤔
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="
                w-10 h-10
                flex items-center justify-center
                rounded-full
                text-[var(--color-muted)]
                hover:text-[var(--color-text)]
                hover:bg-[var(--color-bg)]
                transition-all duration-200
              "
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body - scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <p className="text-[var(--color-text)] leading-relaxed mb-6">
              <strong>Anything.</strong> Seriously. Just say or type whatever comes to mind.
            </p>

            <div className="space-y-5 text-[15px] text-[var(--color-text)]">
              <div className="flex gap-3">
                <span className="text-xl">💪</span>
                <div>
                  <span>"bench 80kg x 6 reps"</span>
                  <p className="text-xs italic text-[var(--color-muted)] mt-0.5">we'll track and improve your workouts</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🍳</span>
                <div>
                  <span>"chicken salad 250gms, 2 rotis"</span>
                  <p className="text-xs italic text-[var(--color-muted)] mt-0.5">we'll calculate macros and optimize your diet</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">😴</span>
                <div>
                  <span>"slept bad, woke up 3 times"</span>
                  <p className="text-xs italic text-[var(--color-muted)] mt-0.5">we'll find out why and help you fix it</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🧠</span>
                <div>
                  <span>"feeling anxious about tomorrow"</span>
                  <p className="text-xs italic text-[var(--color-muted)] mt-0.5">we'll spot patterns and help you understand yourself</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">💧</span>
                <div>
                  <span>"2L water so far"</span>
                  <p className="text-xs italic text-[var(--color-muted)] mt-0.5">we'll track hydration and remind you</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[var(--color-line)]">
              <p className="text-[var(--color-muted)] text-sm leading-relaxed">
                <strong className="text-[var(--color-accent)]">We handle everything.</strong> Macros, patterns, calories, sleep quality — you don't need to think about it. Just dump your thoughts and we'll make sense of it.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[var(--color-line)] bg-[var(--color-bg)]">
            <button
              type="button"
              onClick={handleClose}
              className="
                w-full
                py-3
                text-[15px] font-medium
                text-white
                bg-[var(--color-accent)]
                hover:opacity-90
                transition-opacity
              "
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
