'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { useHydrated } from '@/hooks/useHydrated';
import { SessionsGrid } from './SessionsGrid';

export function SessionsDrawer() {
  const hydrated = useHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
    touchCurrentRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    touchCurrentRef.current = e.touches[0].clientY;
    const dy = Math.max(0, touchCurrentRef.current - touchStartRef.current);
    if (panelRef.current) {
      panelRef.current.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
      panelRef.current.style.transition = dy > 0 ? 'none' : '';
    }
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    const current = touchCurrentRef.current;
    if (start !== null && current !== null && current - start > 100) {
      close();
    } else if (panelRef.current) {
      panelRef.current.style.transform = '';
      panelRef.current.style.transition = '';
    }
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  };

  if (!hydrated) return null;

  return (
    <>
      {/* Trigger button — fixed bottom-right */}
      <button
        onClick={() => setIsOpen(true)}
        className="
          fixed right-4 z-30
          w-11 h-11
          flex items-center justify-center
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
          shadow-[var(--shadow-card)]
          transition-all duration-200
          hover:bg-[var(--color-bg)]
          text-[var(--color-muted)]
          active:scale-95
        "
        style={{ bottom: '120px' }}
        aria-label="Open sessions"
      >
        <Menu className="w-5 h-5" strokeWidth={1.5} />
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className={`
              absolute inset-0 bg-black/40 backdrop-blur-sm
              transition-opacity duration-200
              ${isClosing ? 'opacity-0' : 'opacity-100'}
            `}
            onClick={close}
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className={`
              absolute bottom-0 left-0 right-0
              bg-[var(--color-bg)]
              rounded-t-2xl
              flex flex-col
              ${isClosing ? 'fullscreen-reader-exit' : 'fullscreen-reader-enter'}
            `}
            style={{ height: '100dvh' }}
          >
            {/* Drag handle + close */}
            <div
              className="flex items-center justify-between px-4 pt-3 pb-2"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10" />
              <div className="w-10 h-1 rounded-full bg-[var(--color-line)]" />
              <button
                onClick={close}
                className="
                  w-10 h-10
                  flex items-center justify-center
                  rounded-full
                  text-[var(--color-muted)]
                  hover:text-[var(--color-text)]
                  hover:bg-[var(--color-surface)]
                  transition-all duration-200
                "
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-2 pb-8 sm:px-3">
              <SessionsGrid />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
