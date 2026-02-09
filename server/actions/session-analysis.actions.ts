'use server';

/**
 * Session Analysis Server Actions
 *
 * Universal context analyzer that extracts structured knowledge
 * from any session type and determines the appropriate coach.
 *
 * NOTE: Server-side caching has been removed. Caching is now handled
 * client-side via Zustand/localStorage (see store/cache.store.ts).
 * This file provides stateless LLM analysis functions.
 */

import { requireUser } from '@/server/auth';
import type { SessionKnowledge, SessionAnalysis, TrackerType, AnalysisDelta } from '@/lib/sessions/types';
import {
  UNIVERSAL_ANALYSIS_PROMPT,
  SESSION_ANALYSIS_SCHEMA,
  formatKnowledgeForAnalysis,
} from '@/server/prompts/analysis-prompts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Analyze a session's knowledge and extract structured context
 *
 * This is the universal analyzer that:
 * 1. Determines the session type (gym/diet/addiction/general)
 * 2. Extracts relevant history with pre/post triggers
 * 3. Identifies patterns and trends
 * 4. Finds cross-domain correlations
 * 5. Creates today's actionable plan
 * 6. Generates condensed context for the coach
 *
 * @param sessionTitle - The session title
 * @param sessionGoal - The session goal/context
 * @param knowledge - The retrieved session knowledge
 * @param trackerType - Optional tracker type for specialized formatting (e.g., 'gym' for rotation)
 * @returns Structured SessionAnalysis or null on error
 */
export async function analyzeSession(
  sessionTitle: string,
  sessionGoal: string,
  knowledge: SessionKnowledge,
  trackerType?: TrackerType,
  dietTargets?: { tdee: number; calories: number; protein: number; carbs: number; fat: number; goal: string; proteinPerKg: number; weightKg: number },
  gymWorkoutContext?: { workoutName: string; muscleGroups: string[]; exerciseNames: string[] }
): Promise<SessionAnalysis | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[analyzeSession] No OpenAI API key');
    return null;
  }

  // Format knowledge into structured input
  const input = formatKnowledgeForAnalysis(sessionTitle, sessionGoal, knowledge, trackerType, dietTargets, gymWorkoutContext);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1', // Use full model for better analysis and data extraction
        messages: [
          { role: 'system', content: UNIVERSAL_ANALYSIS_PROMPT },
          { role: 'user', content: input },
        ],
        temperature: 0.2, // Low temperature for strict data adherence
        max_tokens: 8000, // Increased for detailed coach briefing
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'session_analysis',
            strict: true,
            schema: SESSION_ANALYSIS_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[analyzeSession] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('[analyzeSession] No content in response');
      return null;
    }

    try {
      const parsed = JSON.parse(rawContent);

      // Validate and construct the SessionAnalysis object
      const analysis: SessionAnalysis = {
        sessionType: parsed.sessionType || 'general',
        relevantHistory: (parsed.relevantHistory || []).map((h: Record<string, unknown>) => ({
          date: h.date as string,
          event: h.event as string,
          highlight: h.highlight as string | undefined,
          preTriggers: h.preTriggers as string[] | undefined,
          postEffects: h.postEffects as string[] | undefined,
          emotionalContext: h.emotionalContext as string | undefined,
          whatWorked: h.whatWorked as string | undefined,
        })),
        patterns: (parsed.patterns || []).map((p: Record<string, unknown>) => ({
          name: p.name as string,
          description: p.description as string,
          trend: p.trend as 'improving' | 'stable' | 'declining' | 'unknown',
          evidence: p.evidence as string[],
          confidence: p.confidence as 'low' | 'medium' | 'high',
        })),
        correlations: (parsed.correlations || []).map((c: Record<string, unknown>) => ({
          factor: c.factor as string,
          impact: c.impact as string,
          direction: c.direction as 'positive' | 'negative',
          occurrences: c.occurrences as number,
        })),
        historyBriefings: (parsed.historyBriefings || []).map((b: Record<string, unknown>) => ({
          label: b.label as string,
          type: b.type as string,
          fullHistory: b.fullHistory as string,
          linkedPatterns: b.linkedPatterns as string[],
          linkedInsights: b.linkedInsights as string[],
          keyTakeaways: b.keyTakeaways as string,
        })),
        context: parsed.context || '',
        userGoals: parsed.userGoals || undefined,
        userTargets: (parsed.userTargets as { key: string; value: string }[]) || undefined,
        // Enhanced fields for detailed coaching
        coachBriefing: parsed.coachBriefing ? {
          userProfile: parsed.coachBriefing.userProfile as string,
          whatGoesWrong: parsed.coachBriefing.whatGoesWrong as string,
          whyItGoesWrong: parsed.coachBriefing.whyItGoesWrong as string,
          howWeFixedItBefore: parsed.coachBriefing.howWeFixedItBefore as string,
          todaysRisks: parsed.coachBriefing.todaysRisks as string,
          recommendedApproach: parsed.coachBriefing.recommendedApproach as string,
        } : undefined,
        emotionalFactors: (parsed.emotionalFactors || []).map((e: Record<string, unknown>) => ({
          trigger: e.trigger as string,
          emotionalResponse: e.emotionalResponse as string,
          behavioralImpact: e.behavioralImpact as string,
          frequency: e.frequency as number,
        })),
        whatWorkedBefore: (parsed.whatWorkedBefore || []).map((w: Record<string, unknown>) => ({
          situation: w.situation as string,
          strategy: w.strategy as string,
          outcome: w.outcome as string,
          timesWorked: w.timesWorked as number,
        })),
        rootCauses: (parsed.rootCauses || []).map((r: Record<string, unknown>) => ({
          behavior: r.behavior as string,
          underlyingWhy: r.underlyingWhy as string,
          evidence: r.evidence as string[],
        })),
        generatedAt: new Date().toISOString(),
      };

      return analysis;
    } catch (parseError) {
      console.error('[analyzeSession] Failed to parse response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[analyzeSession] Error:', error);
    return null;
  }
}

// JSON Schema for the delta output
const ANALYSIS_DELTA_SCHEMA = {
  type: 'object',
  properties: {
    hasChanges: { type: 'boolean' },
    newHistoryEntries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          event: { type: 'string' },
          highlight: { type: ['string', 'null'] },
          preTriggers: { type: ['array', 'null'], items: { type: 'string' } },
          postEffects: { type: ['array', 'null'], items: { type: 'string' } },
          emotionalContext: { type: ['string', 'null'] },
          whatWorked: { type: ['string', 'null'] },
        },
        required: ['date', 'event', 'highlight', 'preTriggers', 'postEffects', 'emotionalContext', 'whatWorked'],
        additionalProperties: false,
      },
    },
    newPatterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          trend: { type: 'string', enum: ['improving', 'stable', 'declining', 'unknown'] },
          evidence: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'description', 'trend', 'evidence', 'confidence'],
        additionalProperties: false,
      },
    },
    newCorrelations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          factor: { type: 'string' },
          impact: { type: 'string' },
          direction: { type: 'string', enum: ['positive', 'negative'] },
          occurrences: { type: 'number' },
        },
        required: ['factor', 'impact', 'direction', 'occurrences'],
        additionalProperties: false,
      },
    },
    newHistoryBriefings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          type: { type: 'string', enum: ['exercise', 'daily_recap', 'behavioral_pattern'] },
          fullHistory: { type: 'string' },
          linkedPatterns: { type: 'array', items: { type: 'string' } },
          linkedInsights: { type: 'array', items: { type: 'string' } },
          keyTakeaways: { type: 'string' },
        },
        required: ['label', 'type', 'fullHistory', 'linkedPatterns', 'linkedInsights', 'keyTakeaways'],
        additionalProperties: false,
      },
    },
    newEmotionalFactors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          trigger: { type: 'string' },
          emotionalResponse: { type: 'string' },
          behavioralImpact: { type: 'string' },
          frequency: { type: 'number' },
        },
        required: ['trigger', 'emotionalResponse', 'behavioralImpact', 'frequency'],
        additionalProperties: false,
      },
    },
    newWhatWorkedBefore: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          situation: { type: 'string' },
          strategy: { type: 'string' },
          outcome: { type: 'string' },
          timesWorked: { type: 'number' },
        },
        required: ['situation', 'strategy', 'outcome', 'timesWorked'],
        additionalProperties: false,
      },
    },
    newRootCauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          behavior: { type: 'string' },
          underlyingWhy: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
        },
        required: ['behavior', 'underlyingWhy', 'evidence'],
        additionalProperties: false,
      },
    },
    updatedPatterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          trend: { type: ['string', 'null'], enum: ['improving', 'stable', 'declining', 'unknown', null] },
          confidence: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
          newEvidence: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'trend', 'confidence', 'newEvidence'],
        additionalProperties: false,
      },
    },
    updatedHistoryBriefings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          prependFullHistory: { type: ['string', 'null'] },
          keyTakeaways: { type: ['string', 'null'] },
          newLinkedPatterns: { type: 'array', items: { type: 'string' } },
          newLinkedInsights: { type: 'array', items: { type: 'string' } },
        },
        required: ['label', 'prependFullHistory', 'keyTakeaways', 'newLinkedPatterns', 'newLinkedInsights'],
        additionalProperties: false,
      },
    },
    coachBriefingUpdates: {
      type: 'object',
      properties: {
        userProfile: { type: ['string', 'null'] },
        whatGoesWrong: { type: ['string', 'null'] },
        whyItGoesWrong: { type: ['string', 'null'] },
        howWeFixedItBefore: { type: ['string', 'null'] },
        todaysRisks: { type: ['string', 'null'] },
        recommendedApproach: { type: ['string', 'null'] },
      },
      required: ['userProfile', 'whatGoesWrong', 'whyItGoesWrong', 'howWeFixedItBefore', 'todaysRisks', 'recommendedApproach'],
      additionalProperties: false,
    },
    contextAppend: { type: 'string' },
  },
  required: [
    'hasChanges',
    'newHistoryEntries',
    'newPatterns',
    'newCorrelations',
    'newHistoryBriefings',
    'newEmotionalFactors',
    'newWhatWorkedBefore',
    'newRootCauses',
    'updatedPatterns',
    'updatedHistoryBriefings',
    'coachBriefingUpdates',
    'contextAppend',
  ],
  additionalProperties: false,
};

/**
 * Delta analysis — LLM returns ONLY new/changed items.
 * Client merges the delta into the cached SessionAnalysis.
 *
 * Input: compact summary of previous analysis + raw delta events.
 * Output: AnalysisDelta (new items + updates, not a full analysis).
 */
export async function analyzeSessionDelta(
  analysisSummary: string,
  deltaEvents: { id: string; content: string; occurredAt: string; rawJson: unknown }[],
  trackerType?: TrackerType
): Promise<AnalysisDelta | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[analyzeSessionDelta] No OpenAI API key');
    return null;
  }

  const systemPrompt = `You are updating a session analysis with ${deltaEvents.length} new event(s).

## YOUR TASK
Review the new events against the existing analysis summary. Output ONLY:
1. **New items** to add (history entries, patterns, correlations, briefings, etc.)
2. **Updates** to existing items (pattern trend changes, new evidence, briefing updates)
3. **Coach briefing updates** — only the sections that actually need updating based on new events

## RULES
- If the new events don't meaningfully change anything, set hasChanges=false and return empty arrays.
- For updatedPatterns: only include patterns whose trend/confidence actually changed. Set trend/confidence to null if unchanged. Include newEvidence only if there's new evidence to add.
- For updatedHistoryBriefings: only include briefings that need updating. prependFullHistory is new text to ADD to the beginning of the existing history. Set to null if no update needed. keyTakeaways replaces the existing value (set to null to keep existing).
- For coachBriefingUpdates: set fields to null if they don't need updating. Only provide new text for fields that the new events actually affect. todaysRisks and recommendedApproach are most likely to need updates.
- For newHistoryEntries: include ALL exercises with weights and reps. Format: "CHEST: Bench 80kg x 8,8,6 | Incline DB 30kg x 10,9"
- contextAppend: text to prepend to the existing context. Empty string if nothing to add.
- Do NOT hallucinate — only use data from the new events.

## SESSION TYPE
${trackerType || 'general'}`;

  const userContent = `## EXISTING ANALYSIS SUMMARY
${analysisSummary}

## NEW EVENTS (${deltaEvents.length})
${deltaEvents.map(e => `[${e.occurredAt}] ${e.content}${e.rawJson ? `\nStructured data: ${JSON.stringify(e.rawJson)}` : ''}`).join('\n\n')}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 2000, // Much smaller — delta output is compact
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'analysis_delta',
            strict: true,
            schema: ANALYSIS_DELTA_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[analyzeSessionDelta] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('[analyzeSessionDelta] No content in response');
      return null;
    }

    try {
      const parsed = JSON.parse(rawContent) as AnalysisDelta;
      return parsed;
    } catch (parseError) {
      console.error('[analyzeSessionDelta] Failed to parse response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[analyzeSessionDelta] Error:', error);
    return null;
  }
}

