'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft, Sparkles, Hand } from 'lucide-react';
import { useSessionsStore, selectSessions } from '@/store/sessions.store';
import { useHydrated } from '@/hooks/useHydrated';
import { SessionList, EmptyState } from '@/components/sessions';
import { SessionModal } from '@/components/sessions/SessionModal';

const COMPLETION_MODE_KEY = 'brainlm:session-completion-mode';

type CompletionMode = 'auto' | 'manual';

export default function SessionsPage() {
  const hydrated = useHydrated();
  const allSessions = useSessionsStore(selectSessions);
  const sessions = allSessions.filter(s => !s.isCompleted);
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completionMode, setCompletionMode] = useState<CompletionMode>('auto');

  // Load preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(COMPLETION_MODE_KEY);
      if (stored === 'auto' || stored === 'manual') {
        setCompletionMode(stored);
      }
    }
  }, []);

  // Save preference to localStorage when changed
  const handleModeChange = (mode: CompletionMode) => {
    setCompletionMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(COMPLETION_MODE_KEY, mode);
    }
  };

  const handleCreateNew = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSessionCreated = (sessionId: string) => {
    // Navigate to the new session detail page
    router.push(`/sessions/${sessionId}`);
  };

  // Loading state
  const loadingContent = (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
      <p className="text-sm text-[var(--color-muted)] mt-4">Loading sessions...</p>
    </div>
  );

  // Empty state
  const emptyContent = <EmptyState onCreateNew={handleCreateNew} />;

  // Completion mode toggle component
  const completionModeToggle = (
    <div className="relative p-1 bg-[var(--color-bg)] rounded-full border border-[var(--color-line)]">
      {/* Sliding background */}
      <div
        className={`
          absolute top-1 bottom-1 w-[calc(50%-4px)]
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
          shadow-sm
          transition-all duration-300 ease-out
          ${completionMode === 'auto' ? 'left-1' : 'left-[calc(50%+2px)]'}
        `}
      />

      {/* Toggle buttons */}
      <div className="relative flex">
        <button
          onClick={() => handleModeChange('auto')}
          className={`
            flex-1 flex items-center justify-center gap-2
            px-4 py-2.5
            rounded-full
            text-xs font-medium
            transition-all duration-300
            ${completionMode === 'auto'
              ? 'text-[var(--color-text)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }
          `}
        >
          <Sparkles className={`w-3.5 h-3.5 transition-all duration-300 ${completionMode === 'auto' ? 'text-[var(--color-accent)]' : ''}`} />
          <span className="whitespace-nowrap">Auto-sync daily</span>
        </button>

        <button
          onClick={() => handleModeChange('manual')}
          className={`
            flex-1 flex items-center justify-center gap-2
            px-4 py-2.5
            rounded-full
            text-xs font-medium
            transition-all duration-300
            ${completionMode === 'manual'
              ? 'text-[var(--color-text)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }
          `}
        >
          <Hand className={`w-3.5 h-3.5 transition-all duration-300 ${completionMode === 'manual' ? 'text-[var(--color-accent)]' : ''}`} />
          <span className="whitespace-nowrap">Manual completion</span>
        </button>
      </div>
    </div>
  );

  // List content
  const listContent = (
    <div className="space-y-5">
      {/* Completion mode toggle */}
      {completionModeToggle}

      {/* Description */}
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        🧠 Sessions track long-running, sequential, or linked events in your life. Each session assigns you a <span className="inline-flex items-center gap-1.5 text-[var(--color-text)] font-medium">Personalised Thinker<span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span></span></span> — an AI that absorbs relevant context from your life and actively thinks about every entry to <span className="text-[var(--color-accent)]">pivot, suggest, and assist</span> in real-time as you log.
      </p>

      {/* Sessions list */}
      <SessionList sessions={sessions} />
    </div>
  );

  // Determine which content to show
  let mainContent;
  if (!hydrated) {
    mainContent = loadingContent;
  } else if (sessions.length === 0) {
    mainContent = (
      <div className="space-y-5">
        {/* Completion mode toggle */}
        {completionModeToggle}

        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          🧠 Sessions track long-running, sequential, or linked events in your life. Each session assigns you a <span className="inline-flex items-center gap-1.5 text-[var(--color-text)] font-medium">Personalised Thinker<span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span></span></span> — an AI that absorbs relevant context from your life and actively thinks about every entry to <span className="text-[var(--color-accent)]">pivot, suggest, and assist</span> in real-time as you log.
        </p>
        {emptyContent}
      </div>
    );
  } else {
    mainContent = listContent;
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        {/* Header */}
        <header
          className="
            sticky top-0 z-10
            h-14
            flex items-center justify-between
            px-5 sm:px-7
            bg-[var(--color-surface)]
            border-b border-[var(--color-line)]
          "
        >
          <div className="font-serif font-semibold text-lg text-[var(--color-text)]">
            Sessions
          </div>
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-60" />
        </header>

        {/* Main content */}
        <main className="flex-1 py-6 sm:py-8 pb-24 px-5 sm:px-7">
          <div className="max-w-2xl mx-auto">{mainContent}</div>
        </main>

        {/* Fixed back button - bottom left */}
        <Link
          href="/"
          className="
            fixed bottom-6 left-6
            z-20
            w-12 h-12
            flex items-center justify-center
            bg-[var(--color-surface)]
            border border-[var(--color-line)]
            rounded-full
            shadow-lg
            transition-all duration-200
            hover:shadow-xl hover:border-[var(--color-accent)]
            active:scale-95
          "
          aria-label="Go back to home"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text)]" />
        </Link>

        {/* Fixed New button - bottom right */}
        <button
          onClick={handleCreateNew}
          className="
            fixed bottom-6 right-6
            z-20
            w-12 h-12
            flex items-center justify-center
            bg-[var(--color-accent)]
            border border-[var(--color-accent)]
            rounded-full
            shadow-lg
            transition-all duration-200
            hover:shadow-xl hover:brightness-110
            active:scale-95
          "
          aria-label="Create new session"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      <SessionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCreated={handleSessionCreated}
      />
    </>
  );
}
