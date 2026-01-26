'use server';

/**
 * Session Analysis Server Actions
 *
 * Universal context analyzer that extracts structured knowledge
 * from any session type and determines the appropriate coach.
 */

import { requireUser } from '@/server/auth';
import type { SessionKnowledge, SessionAnalysis } from '@/lib/sessions/types';
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
 * @returns Structured SessionAnalysis or null on error
 */
export async function analyzeSession(
  sessionTitle: string,
  sessionGoal: string,
  knowledge: SessionKnowledge
): Promise<SessionAnalysis | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[analyzeSession] No OpenAI API key');
    return null;
  }

  // Format knowledge into structured input
  const input = formatKnowledgeForAnalysis(sessionTitle, sessionGoal, knowledge);

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
