'use client';

import { Brain, BarChart3, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { InsightsSection } from './InsightsSection';
import { KnowledgeContent } from './KnowledgeContent';
import { SessionAnalysis as SessionAnalysisComponent } from '@/components/sessions/SessionAnalysis';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { SuggestedDiet } from '@/components/sessions/SuggestedDiet';
import type { SessionAnalysis, SessionKnowledge, SuggestedDiet as SuggestedDietType } from '@/lib/sessions/types';

interface Props {
  analysis?: SessionAnalysis;
  knowledge?: SessionKnowledge;
  suggestedDiet?: SuggestedDietType;
  emptyLabel?: string;
}

export function InsightsTab({ analysis, knowledge, suggestedDiet, emptyLabel }: Props) {
  return (
    <div className="bg-[var(--color-surface)]">
      {suggestedDiet && (
        <div className="px-5 sm:px-7 py-4 border-b border-[var(--color-line)]">
          <SuggestedDiet suggestedDiet={suggestedDiet} />
        </div>
      )}

      {analysis && (
        <InsightsSection title="Session Analysis" icon={BarChart3} defaultOpen={true}>
          <SessionAnalysisComponent analysis={analysis} />
        </InsightsSection>
      )}

      {knowledge?.yesterdaysReview && (
        <InsightsSection title={`Yesterday (${knowledge.yesterdaysReview.periodKey})`} icon={Calendar} defaultOpen={true}>
          <div className="text-sm">
            <MarkdownRenderer content={knowledge.yesterdaysReview.summary} />
          </div>
        </InsightsSection>
      )}

      {knowledge && (
        <InsightsSection
          title="Knowledge Base"
          icon={Sparkles}
          count={
            knowledge.events.length +
            knowledge.interpretations.length +
            knowledge.patterns.length +
            knowledge.insights.length +
            knowledge.reviews.length
          }
        >
          <KnowledgeContent knowledge={knowledge} />
        </InsightsSection>
      )}

      {!analysis && !knowledge && (
        <div className="flex flex-col items-center justify-center py-16 px-5">
          <Brain className="w-12 h-12 text-[var(--color-line)] mb-4" />
          <p className="font-serif text-lg text-[var(--color-text)]">Building insights...</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {emptyLabel || 'Analysis will appear as you log data'}
          </p>
        </div>
      )}

      {!knowledge && !analysis && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading insights...
        </div>
      )}
    </div>
  );
}
