'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Dumbbell, Utensils, Brain } from 'lucide-react';
import type { Session, TrackerType } from '@/lib/sessions/types';
import { useSessionsStore } from '@/store/sessions.store';

export type QuickSessionType = 'gym' | 'diet' | 'general';

interface SessionModalProps {
  isOpen: boolean;
  session?: Session;
  quickType?: QuickSessionType;  // Pre-select session type
  onClose: () => void;
  onCreated?: (sessionId: string) => void;
  onDeleted?: () => void;
}

// Quick session type presets
const QUICK_SESSION_PRESETS: Record<QuickSessionType, {
  title: string;
  goal: string;
  icon: typeof Dumbbell;
  color: string;
}> = {
  gym: {
    title: 'Not Your Avg. GYM App',
    goal: 'Track workouts, PRs, and become your best self',
    icon: Dumbbell,
    color: 'text-red-500'
  },
  diet: {
    title: 'Diet Log',
    goal: 'Track my meals and stay on target',
    icon: Utensils,
    color: 'text-green-500'
  },
  general: {
    title: '',
    goal: '',
    icon: Brain,
    color: 'text-blue-500'
  }
};

// Inner component that manages its own state
function SessionModalContent({
  session,
  quickType,
  onClose,
  onCreated,
  onDeleted,
}: Omit<SessionModalProps, 'isOpen'>) {
  const isEditing = !!session;
  const preset = quickType ? QUICK_SESSION_PRESETS[quickType] : null;
  const [isClosing, setIsClosing] = useState(false);
  const [title, setTitle] = useState(session?.title || preset?.title || '');
  const [context, setContext] = useState(session?.sessionContext || preset?.goal || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedType, setSelectedType] = useState<QuickSessionType | null>(quickType || null);

  const { createSession, updateSession, deleteSession, setTrackerType } = useSessionsStore();

  // Quick create for preset types
  const handleQuickCreate = (type: QuickSessionType) => {
    if (type === 'general') {
      // For general, just select it and let user fill in details
      setSelectedType('general');
      setTitle('');
      setContext('');
      return;
    }

    const typePreset = QUICK_SESSION_PRESETS[type];
    const newId = createSession(typePreset.title, typePreset.goal);
    setTrackerType(newId, type as TrackerType);
    handleClose();
    onCreated?.(newId);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSave = () => {
    if (!title.trim()) return;

    if (isEditing && session) {
      // Update existing session (no retrieval needed)
      updateSession(session.id, {
        title: title.trim(),
        sessionContext: context.trim(),
      });
      handleClose();
    } else {
      // Create new session immediately, knowledge will be fetched on the detail page
      const newId = createSession(title.trim(), context.trim());
      // Set tracker type if a type was selected
      if (selectedType && selectedType !== 'general') {
        setTrackerType(newId, selectedType as TrackerType);
      }
      handleClose();
      onCreated?.(newId);
    }
  };

  const handleDelete = () => {
    if (session) {
      deleteSession(session.id);
      handleClose();
      onDeleted?.();
    }
  };

  return (
    <div
      className={`
        fixed inset-0 z-50
        bg-[var(--color-surface)]
        flex flex-col
        ${isClosing ? 'fullscreen-reader-exit' : 'fullscreen-reader-enter'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
        <h2 className="font-serif text-xl font-semibold text-[var(--color-text)]">
          {isEditing ? 'Edit Session' : 'New Session'}
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
        <div className="max-w-lg mx-auto space-y-5">
          {/* Quick start buttons (only show in create mode without preset) */}
          {!isEditing && !quickType && !selectedType && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-muted)]">Choose a session type:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickCreate('gym')}
                  className="
                    flex flex-col items-center gap-2 p-4
                    bg-[var(--color-bg)]
                    border border-[var(--color-line)]
                    rounded-lg
                    transition-all duration-200
                    hover:border-red-300 hover:bg-red-50/50
                    dark:hover:bg-red-900/10
                  "
                >
                  <Dumbbell className="w-6 h-6 text-red-500" />
                  <span className="text-sm font-bold text-[var(--color-text)]">GYM App</span>
                </button>
                <button
                  onClick={() => handleQuickCreate('diet')}
                  className="
                    flex flex-col items-center gap-2 p-4
                    bg-[var(--color-bg)]
                    border border-[var(--color-line)]
                    rounded-lg
                    transition-all duration-200
                    hover:border-green-300 hover:bg-green-50/50
                    dark:hover:bg-green-900/10
                  "
                >
                  <Utensils className="w-6 h-6 text-green-500" />
                  <span className="text-sm font-medium text-[var(--color-text)]">Track Diet</span>
                </button>
              </div>
              <p className="text-xs text-[var(--color-muted)] text-center">
                Select a session type to get started with your personalized AI coach
              </p>
            </div>
          )}

          {/* Title and Goal inputs (only show in edit mode or when preset type selected) */}
          {(isEditing || quickType || selectedType) && (
            <>
              {/* Title input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="session-title"
                  className="block text-sm font-medium text-[var(--color-text)]"
                >
                  Title <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  id="session-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Morning Gym, Study Session, Diet Log..."
                  autoFocus={isEditing || !!quickType || !!selectedType}
                  className="
                    w-full px-3 py-3
                    bg-[var(--color-surface)]
                    border border-[var(--color-line)]
                    rounded-[var(--radius-sm)]
                    text-[16px] text-[var(--color-text)]
                    placeholder:text-[var(--color-muted)]
                    transition-all duration-200
                    focus:outline-none focus:border-[var(--color-accent)]
                    focus:ring-2 focus:ring-[var(--color-accent)]/20
                  "
                />
              </div>

              {/* Session Goal textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="session-context"
                  className="block text-sm font-medium text-[var(--color-text)]"
                >
                  Session Goal{' '}
                  <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                </label>
                <textarea
                  id="session-context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="What do you want to achieve? (e.g., 'Push my bench press PR', 'Stay under 2000 calories')"
                  rows={4}
                  className="
                    w-full px-3 py-3
                    bg-[var(--color-surface)]
                    border border-[var(--color-line)]
                    rounded-[var(--radius-sm)]
                    text-[16px] text-[var(--color-text)]
                    placeholder:text-[var(--color-muted)]
                    resize-none
                    transition-all duration-200
                    focus:outline-none focus:border-[var(--color-accent)]
                    focus:ring-2 focus:ring-[var(--color-accent)]/20
                  "
                />
              </div>
            </>
          )}

          {/* Delete section (edit mode only) */}
          {isEditing && (
            <div className="pt-4 border-t border-[var(--color-line)]">
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text)]">
                    Are you sure you want to delete this session? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="
                        flex-1 py-2.5
                        text-sm font-medium
                        text-[var(--color-muted)]
                        bg-transparent
                        border border-[var(--color-line)]
                        rounded-[var(--radius-sm)]
                        transition-all duration-200
                        hover:border-[var(--color-muted)]
                        hover:text-[var(--color-text)]
                      "
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="
                        flex-1 py-2.5
                        text-sm font-medium
                        text-white
                        bg-[var(--color-error)]
                        rounded-[var(--radius-sm)]
                        transition-all duration-200
                        hover:opacity-90
                      "
                    >
                      Delete Session
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="
                    flex items-center gap-2
                    text-sm text-[var(--color-error)]
                    transition-colors
                    hover:opacity-80
                  "
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete this session</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer - only show when editing or when type is selected */}
      {(isEditing || quickType || selectedType) && (
        <div className="px-5 py-4 border-t border-[var(--color-line)] bg-[var(--color-bg)]">
          <div className="max-w-lg mx-auto flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="
                flex-1 py-3
                text-[15px] font-medium
                text-[var(--color-muted)]
                bg-transparent
                border border-[var(--color-line)]
                rounded-[var(--radius-sm)]
                transition-all duration-200
                hover:border-[var(--color-muted)]
                hover:text-[var(--color-text)]
              "
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="
                flex-1 py-3
                text-[15px] font-medium
                text-white
                bg-[var(--color-accent)]
                rounded-[var(--radius-sm)]
                transition-all duration-200
                hover:opacity-90
                disabled:opacity-40
                disabled:cursor-not-allowed
              "
            >
              {isEditing ? 'Save Changes' : 'Create Session'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper component that only renders content when open
// The key prop forces remount when session changes, resetting form state
export function SessionModal({
  isOpen,
  session,
  quickType,
  onClose,
  onCreated,
  onDeleted,
}: SessionModalProps) {
  if (!isOpen) return null;

  // Using session.id as key ensures form resets when editing different sessions
  // For create mode (no session), we use 'new' as key
  return (
    <SessionModalContent
      key={session?.id || quickType || 'new'}
      session={session}
      quickType={quickType}
      onClose={onClose}
      onCreated={onCreated}
      onDeleted={onDeleted}
    />
  );
}
