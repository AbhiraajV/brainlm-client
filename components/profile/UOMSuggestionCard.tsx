'use client';

import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from 'lucide-react';
import { UOMDriftType, ConfidenceLevel } from '@prisma/client';

export interface UOMSuggestionData {
  id: string;
  suggestion: string;
  reasoning: string;
  driftType: UOMDriftType;
  confidence: ConfidenceLevel;
  targetSection: string | null;
  createdAt: Date;
}

interface UOMSuggestionCardProps {
  suggestion: UOMSuggestionData;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const driftTypeConfig: Record<UOMDriftType, {
  icon: React.ReactNode;
  label: string;
  bg: string;
  text: string;
  description: string;
}> = {
  ADDITION: {
    icon: <Plus className="w-3 h-3" />,
    label: 'New',
    bg: 'bg-[var(--color-accent)]/15',
    text: 'text-[var(--color-accent)]',
    description: 'Something new we learned about you',
  },
  MODIFICATION: {
    icon: <Pencil className="w-3 h-3" />,
    label: 'Update',
    bg: 'bg-[var(--color-warn)]/15',
    text: 'text-[var(--color-warn)]',
    description: 'An update to what we know',
  },
  REMOVAL: {
    icon: <Trash2 className="w-3 h-3" />,
    label: 'Remove',
    bg: 'bg-[var(--color-error)]/15',
    text: 'text-[var(--color-error)]',
    description: 'Something that may no longer apply',
  },
};

const confidenceConfig: Record<ConfidenceLevel, { label: string; opacity: string }> = {
  HIGH: { label: 'High confidence', opacity: 'opacity-100' },
  MEDIUM: { label: 'Medium confidence', opacity: 'opacity-70' },
  EMERGING: { label: 'Emerging', opacity: 'opacity-50' },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function UOMSuggestionCard({ suggestion, onAccept, onReject }: UOMSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const drift = driftTypeConfig[suggestion.driftType];
  const confidence = confidenceConfig[suggestion.confidence];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Drift type badge */}
          <div className="flex items-center gap-2">
            <span className={`
              inline-flex items-center gap-1.5 px-2.5 py-1
              text-[11px] font-medium uppercase tracking-wide
              rounded-full
              ${drift.bg} ${drift.text}
            `}>
              {drift.icon}
              {drift.label}
            </span>

            {/* Confidence indicator */}
            <span className={`text-[11px] text-[var(--color-muted)] ${confidence.opacity}`}>
              {confidence.label}
            </span>
          </div>

          {/* Timestamp */}
          <span className="text-[11px] text-[var(--color-muted)] shrink-0">
            {formatTimeAgo(suggestion.createdAt)}
          </span>
        </div>

        {/* Target section if available */}
        {suggestion.targetSection && (
          <p className="text-[11px] text-[var(--color-muted)] mb-2">
            Section: <span className="font-medium">{suggestion.targetSection}</span>
          </p>
        )}

        {/* Suggestion content */}
        <p className="text-sm text-[var(--color-text)] leading-relaxed">
          {suggestion.suggestion}
        </p>
      </div>

      {/* Reasoning section (collapsible) */}
      <div className="border-t border-[var(--color-line)]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="
            w-full flex items-center justify-between
            px-4 py-2.5
            text-[12px] text-[var(--color-muted)]
            hover:bg-[var(--color-bg)]
            transition-colors duration-150
          "
        >
          <span>Why we suggest this</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-4 pt-1">
            <p className="text-[13px] text-[var(--color-muted)] leading-relaxed">
              {suggestion.reasoning}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="
        flex items-center gap-2
        px-4 py-3
        bg-[var(--color-bg)]
        border-t border-[var(--color-line)]
      ">
        <button
          onClick={() => onAccept(suggestion.id)}
          className="
            flex-1 flex items-center justify-center gap-2
            py-2.5 px-4
            bg-[var(--color-accent)]
            text-white text-sm font-medium
            rounded-[var(--radius-sm)]
            transition-all duration-150
            hover:bg-[var(--color-accent-dark)]
            active:scale-[0.98]
          "
        >
          <Check className="w-4 h-4" />
          Accept
        </button>

        <button
          onClick={() => onReject(suggestion.id)}
          className="
            flex-1 flex items-center justify-center gap-2
            py-2.5 px-4
            bg-transparent
            text-[var(--color-muted)] text-sm font-medium
            border border-[var(--color-line)]
            rounded-[var(--radius-sm)]
            transition-all duration-150
            hover:border-[var(--color-muted)] hover:text-[var(--color-text)]
            active:scale-[0.98]
          "
        >
          <X className="w-4 h-4" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
