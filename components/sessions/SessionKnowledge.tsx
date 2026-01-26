'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Loader2, Tag } from 'lucide-react';
import type {
  SessionKnowledge as SessionKnowledgeType,
  KnowledgeEvent,
  KnowledgeInterpretation,
  KnowledgePattern,
  KnowledgeInsight,
  KnowledgeReview,
} from '@/lib/sessions/types';
import { fetchSessionKnowledge } from '@/server/actions/session-knowledge.actions';
import { useSessionsStore } from '@/store/sessions.store';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface SessionKnowledgeProps {
  sessionId: string;
  title: string;
  context: string;
  knowledge?: SessionKnowledgeType;
}

// Section configurations
const sectionConfig = {
  events: { label: 'Events', color: 'var(--color-accent)' },
  interpretations: { label: 'Interpretations', color: 'var(--color-accent-secondary)' },
  patterns: { label: 'Patterns', color: 'var(--color-warn)' },
  insights: { label: 'Insights', color: 'var(--color-success)' },
  reviews: { label: 'Reviews', color: 'var(--color-muted)' },
};

function EventCard({ event }: { event: KnowledgeEvent }) {
  return (
    <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-line)]">
      <p className="text-sm text-[var(--color-text)] leading-relaxed">{event.content}</p>
      <p className="text-micro text-[var(--color-muted)] mt-1">
        {new Date(event.occurredAt).toLocaleDateString()}
      </p>
    </div>
  );
}

function InterpretationCard({ interpretation }: { interpretation: KnowledgeInterpretation }) {
  return (
    <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-line)]">
      <div className="text-sm">
        <MarkdownRenderer content={interpretation.content} />
      </div>
      <p className="text-micro text-[var(--color-muted)] mt-2">
        {new Date(interpretation.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

function PatternCard({ pattern }: { pattern: KnowledgePattern }) {
  return (
    <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-line)]">
      <p className="text-sm font-medium text-[var(--color-text)] mb-2">{pattern.name}</p>
      <div className="text-sm">
        <MarkdownRenderer content={pattern.description} />
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: KnowledgeInsight }) {
  return (
    <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-line)]">
      <div className="text-sm">
        <MarkdownRenderer content={insight.content} />
      </div>
      <p className="text-micro text-[var(--color-muted)] mt-2">
        {new Date(insight.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

function ReviewCard({ review }: { review: KnowledgeReview }) {
  return (
    <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-line)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 bg-[var(--color-surface)] rounded text-[var(--color-muted)]">
          {review.type}
        </span>
        <span className="text-micro text-[var(--color-muted)]">{review.periodKey}</span>
      </div>
      <div className="text-sm">
        <MarkdownRenderer content={review.summary} />
      </div>
    </div>
  );
}

interface SectionProps<T> {
  title: string;
  color: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}

function Section<T>({ title, color, items, renderItem }: SectionProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="border-t border-[var(--color-line)] pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--color-muted)]" />
        )}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium text-[var(--color-text)]">{title}</span>
        <span className="text-xs text-[var(--color-muted)]">({items.length})</span>
      </button>
      {isExpanded && (
        <div className="space-y-2 mt-2 pl-5">
          {items.map((item, i) => renderItem(item, i))}
        </div>
      )}
    </div>
  );
}

function SeedDisplay({ seed }: { seed: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const keywords = seed.split(',').map((k) => k.trim()).filter(Boolean);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        <Tag className="w-3 h-3" />
        <span>Keywords ({keywords.length})</span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
      {isExpanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {keywords.map((keyword, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 bg-[var(--color-bg)] border border-[var(--color-line)] rounded-full text-[var(--color-muted)]"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionKnowledge({ sessionId, title, context, knowledge }: SessionKnowledgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSessionKnowledge = useSessionsStore((state) => state.setSessionKnowledge);
  const setTrackerType = useSessionsStore((state) => state.setTrackerType);

  // Debug logging
  const totalItems = knowledge
    ? knowledge.events.length +
      knowledge.interpretations.length +
      knowledge.patterns.length +
      knowledge.insights.length +
      knowledge.reviews.length
    : 0;
  console.log('[SessionKnowledge] Render - knowledge:', knowledge ? `${totalItems} items` : 'none', 'isLoading:', isLoading);

  // Fetch knowledge if not already present
  useEffect(() => {
    if (knowledge) return;

    let cancelled = false;

    async function loadKnowledge() {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[SessionKnowledge] Fetching knowledge for session:', sessionId);
        const result = await fetchSessionKnowledge(title, context);

        if (cancelled) return;

        if (result) {
          console.log('[SessionKnowledge] Got knowledge with seed:', result.seed, 'trackerType:', result.trackerType);
          setSessionKnowledge(sessionId, result.knowledge);
          // Also set the inferred tracker type
          setTrackerType(sessionId, result.trackerType);
        } else {
          console.log('[SessionKnowledge] No knowledge returned');
          setError('No relevant knowledge found');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[SessionKnowledge] Error fetching knowledge:', err);
        setError('Failed to fetch knowledge');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadKnowledge();

    return () => {
      cancelled = true;
    };
  }, [sessionId, title, context, knowledge, setSessionKnowledge, setTrackerType]);

  // Loading state (but not if knowledge already arrived)
  if (isLoading && !knowledge) {
    return (
      <div className="mb-2">
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />
          <span className="text-sm text-[var(--color-muted)]">
            Fetching relevant knowledge...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !knowledge) {
    return (
      <div className="mb-2">
        <div className="flex items-center gap-2 py-2">
          <Sparkles className="w-4 h-4 text-[var(--color-muted)]" />
          <span className="text-sm text-[var(--color-muted)]">
            {error}
          </span>
        </div>
      </div>
    );
  }

  // No knowledge yet (shouldn't happen normally)
  if (!knowledge) {
    return null;
  }

  const { events, interpretations, patterns, insights, reviews, seed } = knowledge;

  if (totalItems === 0) {
    return (
      <div className="mb-2">
        <div className="flex items-center gap-2 py-2">
          <Sparkles className="w-4 h-4 text-[var(--color-muted)]" />
          <span className="text-sm text-[var(--color-muted)]">
            No relevant knowledge found
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text)]">
            Session Knowledge
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            ({totalItems} items)
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--color-muted)] transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="pt-2">
          {/* Seed keywords */}
          {seed && <SeedDisplay seed={seed} />}

          {/* Grouped sections */}
          <Section
            title={sectionConfig.events.label}
            color={sectionConfig.events.color}
            items={events}
            renderItem={(event, i) => <EventCard key={event.id || i} event={event} />}
          />
          <Section
            title={sectionConfig.interpretations.label}
            color={sectionConfig.interpretations.color}
            items={interpretations}
            renderItem={(interp, i) => <InterpretationCard key={interp.id || i} interpretation={interp} />}
          />
          <Section
            title={sectionConfig.patterns.label}
            color={sectionConfig.patterns.color}
            items={patterns}
            renderItem={(pattern, i) => <PatternCard key={pattern.id || i} pattern={pattern} />}
          />
          <Section
            title={sectionConfig.insights.label}
            color={sectionConfig.insights.color}
            items={insights}
            renderItem={(insight, i) => <InsightCard key={insight.id || i} insight={insight} />}
          />
          <Section
            title={sectionConfig.reviews.label}
            color={sectionConfig.reviews.color}
            items={reviews}
            renderItem={(review, i) => <ReviewCard key={review.id || i} review={review} />}
          />
        </div>
      )}
    </div>
  );
}
