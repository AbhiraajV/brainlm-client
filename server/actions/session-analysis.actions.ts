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
import type { SessionKnowledge, SessionAnalysis, TrackerType } from '@/lib/sessions/types';
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
  trackerType?: TrackerType
): Promise<SessionAnalysis | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[analyzeSession] No OpenAI API key');
    return null;
  }

  // Format knowledge into structured input
  const input = formatKnowledgeForAnalysis(sessionTitle, sessionGoal, knowledge, trackerType);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use full model for better analysis and data extraction
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
        todaysPlan: {
          summary: parsed.todaysPlan?.summary || '',
          items: (parsed.todaysPlan?.items || []).map((i: Record<string, unknown>) => ({
            suggestion: i.suggestion as string,
            rationale: i.rationale as string,
            metrics: (i.metrics as { key: string; value: string }[]) || [],
          })),
        },
        context: parsed.context || '',
        userGoals: parsed.userGoals || undefined,
        userTargets: (parsed.userTargets as { key: string; value: string }[]) || undefined,
        // New enhanced fields for detailed coaching
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

/**
 * Incremental analysis update using a smaller/cheaper model
 * Takes the previous analysis and delta events, returns updated analysis
 *
 * This is exported as a stateless server action for client-side caching.
 * The client manages the cache; this just does the LLM work.
 */
export async function analyzeSessionIncrementalStateless(
  previousAnalysis: SessionAnalysis,
  deltaEvents: { id: string; content: string; occurredAt: Date; rawJson: unknown }[],
  trackerType?: TrackerType
): Promise<SessionAnalysis | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[analyzeSessionIncremental] No OpenAI API key');
    return null;
  }

  const systemPrompt = `You are updating a previously generated session analysis with new data.

## RULES
1. Keep ALL relevant history from the previous analysis
2. Add new events to relevantHistory with proper details
3. Update pattern trends only if new evidence warrants changes
4. Recalculate todaysPlan based on TODAY: ${new Date().toISOString().split('T')[0]}
5. Keep coachBriefing comprehensive - update and extend, don't shorten
6. Preserve all emotional factors, what worked before, and root causes
7. Add new entries to these arrays if delta events reveal new patterns

Previous analysis was from: ${previousAnalysis.generatedAt}
You're incorporating ${deltaEvents.length} new events.

Return a complete SessionAnalysis JSON object matching the exact schema.`;

  const userContent = `## PREVIOUS ANALYSIS
${JSON.stringify(previousAnalysis, null, 2)}

## NEW EVENTS SINCE LAST ANALYSIS (${deltaEvents.length} events)
${deltaEvents.map(e => `[${e.occurredAt.toISOString()}] ${e.content}${e.rawJson ? `\nStructured data: ${JSON.stringify(e.rawJson)}` : ''}`).join('\n\n')}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Smaller model for incremental updates (~80% cheaper)
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 4000,
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
      console.error('[analyzeSessionIncremental] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('[analyzeSessionIncremental] No content in response');
      return null;
    }

    try {
      const parsed = JSON.parse(rawContent);

      // Same parsing logic as analyzeSession
      const analysis: SessionAnalysis = {
        sessionType: parsed.sessionType || previousAnalysis.sessionType,
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
        todaysPlan: {
          summary: parsed.todaysPlan?.summary || '',
          items: (parsed.todaysPlan?.items || []).map((i: Record<string, unknown>) => ({
            suggestion: i.suggestion as string,
            rationale: i.rationale as string,
            metrics: (i.metrics as { key: string; value: string }[]) || [],
          })),
        },
        context: parsed.context || '',
        userGoals: parsed.userGoals || undefined,
        userTargets: (parsed.userTargets as { key: string; value: string }[]) || undefined,
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
      console.error('[analyzeSessionIncremental] Failed to parse response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[analyzeSessionIncremental] Error:', error);
    return null;
  }
}

