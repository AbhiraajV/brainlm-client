'use client';

import { useState } from 'react';
import { MessageCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface EventSuggestionProps {
  sessionId?: string;
  eventId: string;
  status?: 'pending' | 'generating' | 'completed' | 'failed';
  comment?: string;
  error?: string;
  onRetry: () => void;
}

export function EventSuggestion({
  status,
  comment,
  error,
  onRetry,
}: EventSuggestionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render anything if no status or pending
  if (!status || status === 'pending') {
    return null;
  }

  // Generating state - minimal inline indicator
  if (status === 'generating') {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[var(--color-muted)]">
        <div className="w-1 h-1 rounded-full bg-[var(--color-muted)] animate-pulse" />
        <div className="w-1 h-1 rounded-full bg-[var(--color-muted)] animate-pulse [animation-delay:150ms]" />
        <div className="w-1 h-1 rounded-full bg-[var(--color-muted)] animate-pulse [animation-delay:300ms]" />
      </div>
    );
  }

  // Failed state - error message with retry button
  if (status === 'failed') {
    return (
      <div className="mt-3 ml-0">
        <div
          className="
            flex items-start gap-2
            p-3
            bg-[var(--color-error)]/5
            border border-[var(--color-error)]/20
            rounded-[var(--radius-sm)]
          "
        >
          <AlertCircle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--color-error)]">
              {error || 'Failed to generate suggestion'}
            </p>
            <button
              onClick={onRetry}
              className="
                mt-2
                flex items-center gap-1.5
                text-xs font-medium
                text-[var(--color-accent)]
                hover:underline
              "
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completed state - show the suggestion in a threaded style
  if (status === 'completed' && comment) {
    return (
      <div className="mt-3 ml-0">
        <div
          className="
            relative
            pl-4
            border-l-2 border-[var(--color-accent)]/30
          "
        >
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="
              flex items-center gap-2
              text-xs text-[var(--color-muted)]
              hover:text-[var(--color-text)]
              transition-colors
            "
          >
            <MessageCircle className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="font-medium text-[var(--color-accent)]">Coach</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {/* Content */}
          {isExpanded && (
            <p className="mt-1.5 text-sm text-[var(--color-text)] leading-relaxed">
              {comment}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
