/**
 * Coach Agent — Read-Only Conversational Coach
 *
 * Shared coach for all tracker types. No tools — purely conversational.
 * Takes the full coaching context (analysis, patterns, history) and
 * returns evidence-based advice.
 *
 * Uses gpt-4o-mini for fast responses.
 */

import type {
  TrackerType,
  SessionAnalysis,
  MenstrualCycleInfo,
} from '@/lib/sessions/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      refusal?: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CoachResult {
  comment: string;
  error?: string;
}

/**
 * Build the system prompt for the coach agent.
 * Inherits ALL coaching context from the old combined agents.
 */
function buildCoachPrompt(
  trackerType: TrackerType,
  keyContext: string,
  analysis?: SessionAnalysis,
  currentSessionSummary?: string,
  cyclePhase?: MenstrualCycleInfo
): string {
  // Build exercise/day briefings
  const briefings = analysis?.historyBriefings?.length
    ? analysis.historyBriefings.map(b =>
        `### ${b.label}\n${b.fullHistory}\nPatterns: ${b.linkedPatterns.join('; ')}\nInsights: ${b.linkedInsights.join('; ')}\nKey: ${b.keyTakeaways}`
      ).join('\n\n')
    : '';

  const userContext = analysis ? `
## HISTORY
${briefings || '(No history briefings available)'}

## RECENT SESSIONS
${analysis.relevantHistory?.map(h => `${h.date}: ${h.event}`).join('\n') || '(No history)'}

## ADDITIONAL CONTEXT
${analysis.context || '(No additional context)'}
` : '';

  // Deep coaching context
  const coachingContext = analysis ? `
## DEEP USER CONTEXT

${analysis.coachBriefing ? `### Who This User Is
${analysis.coachBriefing.userProfile}

### What Goes Wrong For Them
${analysis.coachBriefing.whatGoesWrong}

### WHY It Goes Wrong
${analysis.coachBriefing.whyItGoesWrong}

### What Has Worked Before
${analysis.coachBriefing.howWeFixedItBefore}

### Today's Risks
${analysis.coachBriefing.todaysRisks}

### Recommended Coaching Approach
${analysis.coachBriefing.recommendedApproach}
` : ''}

${(analysis.patterns?.length ?? 0) > 0 ? `### Identified Patterns
${analysis.patterns!.map(p => `- ${p.name}: ${p.description} (trend: ${p.trend}, confidence: ${p.confidence})`).join('\n')}` : ''}

${(analysis.correlations?.length ?? 0) > 0 ? `### Performance Correlations
${analysis.correlations!.map(c => `- ${c.factor} → ${c.direction} impact on "${c.impact}" (seen ${c.occurrences}x)`).join('\n')}` : ''}

${(analysis.emotionalFactors?.length ?? 0) > 0 ? `### Emotional Triggers
${analysis.emotionalFactors!.map(e => `- ${e.trigger} → ${e.emotionalResponse} → ${e.behavioralImpact}`).join('\n')}` : ''}

${(analysis.whatWorkedBefore?.length ?? 0) > 0 ? `### Proven Success Strategies
${analysis.whatWorkedBefore!.map(w => `- When: ${w.situation} → Strategy: ${w.strategy} → Result: ${w.outcome} (worked ${w.timesWorked}x)`).join('\n')}` : ''}

${(analysis.rootCauses?.length ?? 0) > 0 ? `### Root Causes
${analysis.rootCauses!.map(r => `- Behavior: ${r.behavior} → Why: ${r.underlyingWhy}`).join('\n')}` : ''}
` : '';

  // Cycle phase
  const cycleContext = cyclePhase?.tracking
    ? `
## CYCLE PHASE AWARENESS
Current phase: ${cyclePhase.currentPhase || 'unknown'}
Day of cycle: ${cyclePhase.dayOfCycle || 'unknown'}
${cyclePhase.currentPhase === 'menstrual' ? 'Consider reducing intensity, focus on comfort' : ''}
${cyclePhase.currentPhase === 'follicular' ? 'Good phase for pushing, optimal recovery' : ''}
${cyclePhase.currentPhase === 'ovulation' ? 'Peak performance window, great for PRs' : ''}
${cyclePhase.currentPhase === 'luteal' ? 'Same weights feel harder (hormonal), metabolism +100-300cal, cravings normal' : ''}
`
    : '';

  // Tracker-specific coaching style
  const coachStyle = trackerType === 'gym'
    ? `You are a personal gym coach with deep knowledge of this user's training history and patterns.
Reference their actual workout data, PRs, volume trends, and what has worked for them before.`
    : trackerType === 'diet'
    ? `You are a personal nutrition coach with deep knowledge of this user's eating patterns and habits.
Reference their actual diet data, macro trends, and what has worked for them before.`
    : `You are a personal coach with deep knowledge of this user's history and patterns.`;

  return `${coachStyle}

Answer their question using evidence from the context provided.
Be direct, specific, and concise (1-3 sentences).
Never update or modify any data — you are read-only.
Reference actual data from context, never hypotheticals.
If you don't have relevant data, say so honestly.
No markdown, no formatting, no bullet points — just plain conversational text.

${currentSessionSummary ? `## TODAY'S SESSION (read-only)
${currentSessionSummary}
` : ''}
${userContext}
${coachingContext}
${cycleContext}

## DOMAIN KNOWLEDGE
${keyContext || '(No prior history available)'}

## RESPONSE RULES
- 1-3 sentences max
- Reference their actual data ("last week you...", "your pattern shows...")
- Compare to their real history, not hypotheticals
- If a cross-domain correlation explains performance, mention it briefly
- Don't recite numbers the log card already shows
- Don't give generic advice — be specific to THIS user
`;
}

/**
 * Execute the coach agent — no tools, read-only
 */
export async function executeCoach(
  trackerType: TrackerType,
  userMessage: string,
  previousMessages: ChatMessage[],
  keyContext: string,
  analysis?: SessionAnalysis,
  currentSessionSummary?: string,
  cyclePhase?: MenstrualCycleInfo,
): Promise<CoachResult> {
  if (!OPENAI_API_KEY) {
    return {
      comment: 'Configuration error - please check API settings.',
      error: 'No OpenAI API key configured'
    };
  }

  const systemPrompt = buildCoachPrompt(trackerType, keyContext, analysis, currentSessionSummary, cyclePhase);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...previousMessages,
    { role: 'user', content: userMessage }
  ];

  try {
    const requestBody: Record<string, unknown> = {
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,  // Slightly higher for natural conversation
      max_tokens: 300,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[CoachAgent] OpenAI error:', error);
      return {
        comment: 'Something went wrong. Please try again.',
        error: 'OpenAI API error'
      };
    }

    const data: OpenAIResponse = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        comment: 'No response generated.',
        error: 'Empty response'
      };
    }

    return { comment: content };
  } catch (error) {
    console.error('[CoachAgent] Error:', error);
    return {
      comment: 'Something went wrong. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
