'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Zap,
  Target,
  BarChart3,
  Link2,
} from 'lucide-react';
import type { SessionAnalysis as SessionAnalysisType } from '@/lib/sessions/types';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface Props {
  analysis: SessionAnalysisType;
}

// Trend icon component
function TrendIcon({ trend }: { trend: 'improving' | 'stable' | 'declining' | 'unknown' }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-3 h-3 text-[var(--color-success)]" />;
    case 'declining':
      return <TrendingDown className="w-3 h-3 text-[var(--color-error)]" />;
    case 'stable':
      return <Minus className="w-3 h-3 text-[var(--color-lime)]" />;
    default:
      return <Minus className="w-3 h-3 text-[var(--color-muted)]" />;
  }
}

// Confidence badge
function ConfidenceBadge({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-[var(--color-line)] text-[var(--color-muted)]',
    medium: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
    high: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
  };

  return (
    <span className={`text-[9px] px-1 py-0.5 rounded ${colors[confidence]}`}>
      {confidence}
    </span>
  );
}

// Collapsible section component
function Section({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-[var(--color-line)] pt-2 mt-2 first:border-t-0 first:pt-0 first:mt-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 py-1 text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--color-muted)]" />
        )}
        <Icon className="w-3 h-3 text-[var(--color-muted)]" />
        <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] text-[var(--color-muted)]">({count})</span>
        )}
      </button>
      {isOpen && <div className="mt-2 pl-5 text-xs text-[var(--color-text)]">{children}</div>}
    </div>
  );
}

export function SessionAnalysis({ analysis }: Props) {
  const { relevantHistory, patterns, correlations, todaysPlan, context } = analysis;

  return (
    <div className="space-y-1">
      {/* Today's Plan - Always show first and expanded */}
      {todaysPlan.items.length > 0 && (
        <Section title="Today's Plan" icon={Target} defaultOpen={true}>
          <div className="space-y-2">
            <p className="text-[var(--color-muted)] italic mb-2">{todaysPlan.summary}</p>
            {todaysPlan.items.map((item, i) => (
              <div
                key={i}
                className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)]"
              >
                <p className="font-medium">{item.suggestion}</p>
                <p className="text-[10px] text-[var(--color-muted)] mt-1">{item.rationale}</p>
                {item.metrics && item.metrics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.metrics.map((metric, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-1.5 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded"
                      >
                        {metric.key}: {metric.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Patterns with Trends */}
      {patterns.length > 0 && (
        <Section title="Patterns" icon={BarChart3} count={patterns.length}>
          <div className="space-y-2">
            {patterns.map((pattern, i) => (
              <div
                key={i}
                className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendIcon trend={pattern.trend} />
                  <span className="font-medium">{pattern.name}</span>
                  <ConfidenceBadge confidence={pattern.confidence} />
                </div>
                <p className="text-[var(--color-muted)]">{pattern.description}</p>
                {pattern.evidence.length > 0 && (
                  <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                    Evidence: {pattern.evidence.slice(0, 3).join(' | ')}
                    {pattern.evidence.length > 3 && ` +${pattern.evidence.length - 3} more`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Correlations */}
      {correlations.length > 0 && (
        <Section title="Correlations" icon={Link2} count={correlations.length}>
          <div className="space-y-1">
            {correlations.map((corr, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-1.5 bg-[var(--color-bg)] rounded border border-[var(--color-line)]"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    corr.direction === 'positive' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="flex-1">
                  <span className="font-medium">{corr.factor}</span>
                  <span className="text-[var(--color-muted)]"> {corr.impact}</span>
                </span>
                <span className="text-[9px] text-[var(--color-muted)]">
                  {corr.occurrences}x
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recent History Timeline */}
      {relevantHistory.length > 0 && (
        <Section title="Recent History" icon={Clock} count={relevantHistory.length}>
          <div className="space-y-2">
            {relevantHistory.slice(0, 7).map((item, i) => (
              <div
                key={i}
                className="relative pl-3 border-l-2 border-[var(--color-line)] py-1"
              >
                <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-[var(--color-muted)]" />
                <div className="text-[10px] text-[var(--color-muted)]">{item.date}</div>
                <div className="font-medium">{item.event}</div>
                {item.highlight && (
                  <div className="text-[10px] text-[var(--color-accent)]">{item.highlight}</div>
                )}
                {item.preTriggers && item.preTriggers.length > 0 && (
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Before: {item.preTriggers.join(', ')}
                  </div>
                )}
                {item.postEffects && item.postEffects.length > 0 && (
                  <div className="text-[10px] text-[var(--color-muted)]">
                    After: {item.postEffects.join(', ')}
                  </div>
                )}
              </div>
            ))}
            {relevantHistory.length > 7 && (
              <div className="text-[10px] text-[var(--color-muted)] pl-3">
                +{relevantHistory.length - 7} more events
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Context Summary */}
      {context && (
        <Section title="Context" icon={Zap}>
          <div className="max-h-32 overflow-y-auto">
            <MarkdownRenderer content={context} />
          </div>
        </Section>
      )}
    </div>
  );
}
