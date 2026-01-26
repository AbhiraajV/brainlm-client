'use server';

/**
 * Event Suggestion Server Actions
 *
 * Provides real-time LLM-powered coaching suggestions after each event is logged.
 * Uses specialized prompts based on tracker type (diet, gym, addiction, general).
 *
 * For diet/gym trackers: Returns both masterSummary and comment
 * For addiction/general: Returns comment only
 */

import { requireUser } from '@/server/auth';
import type { TrackerType, MenstrualCycleInfo } from '@/lib/sessions/types';
import {
  getEventCoachPrompt,
  hasMasterSummary,
  extractSection,
} from '@/server/prompts/tracker-prompts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface PreviousEvent {
  content: string;
  createdAt: string;
  llmComment?: string;
}

interface TodayEvent {
  content: string;
  occurredAt: string;
}

interface YesterdaysReview {
  summary: string;
  periodKey: string;
}

interface TodaysPlan {
  renderedMarkdown: string;
}

export interface EventSuggestionResult {
  comment: string;
  masterSummary?: string;
}

/**
 * Generate an LLM coaching suggestion for a newly logged event
 *
 * @param sessionId - The session ID (for logging purposes)
 * @param eventId - The event ID (for logging purposes)
 * @param eventContent - The content of the new event
 * @param previousEvents - Previous events in this session
 * @param sessionTitle - The session title
 * @param sessionGoal - The session goal (explicit or inferred)
 * @param guide - The session guide name
 * @param keyContext - Domain knowledge from brain transfer
 * @param trackerType - Specialized tracker type (diet, gym, addiction, general)
 * @param currentMasterSummary - Current master summary (for diet/gym trackers)
 * @param todaysEvents - All events from today (optional)
 * @param yesterdaysReview - Yesterday's review summary (optional)
 * @param todaysPlan - Today's daily plan with focus areas and targets (optional)
 * @param cyclePhase - Menstrual cycle phase info for female users (optional)
 * @returns The suggestion with comment and optional masterSummary, or an error
 */
export async function generateEventSuggestion(
  sessionId: string,
  eventId: string,
  eventContent: string,
  previousEvents: PreviousEvent[],
  sessionTitle: string,
  sessionGoal: string,
  guide: string,
  keyContext: string,
  trackerType: TrackerType = 'general',
  currentMasterSummary?: string,
  todaysEvents?: TodayEvent[],
  yesterdaysReview?: YesterdaysReview,
  todaysPlan?: TodaysPlan,
  cyclePhase?: MenstrualCycleInfo
): Promise<EventSuggestionResult | { error: string }> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[generateEventSuggestion] No OpenAI API key');
    return { error: 'API configuration error' };
  }

  // Format previous events with coach responses
  const formattedPreviousEvents = previousEvents.length > 0
    ? previousEvents
        .map((e, i) => {
          let entry = `${i + 1}. ${e.content} (${formatRelativeTime(e.createdAt)})`;
          if (e.llmComment) {
            entry += `\n   → Coach: ${e.llmComment}`;
          }
          return entry;
        })
        .join('\n\n')
    : '(none - this is the first event)';

  // Format today's plan section
  const todaysPlanSection = todaysPlan?.renderedMarkdown
    ? `TODAY'S PLAN:\n${todaysPlan.renderedMarkdown}`
    : '';

  // Format today's events section
  const todaysEventsSection = todaysEvents && todaysEvents.length > 0
    ? `TODAY'S EVENTS SO FAR:\n${todaysEvents.map((e) => `- ${formatTime(e.occurredAt)}: ${e.content}`).join('\n')}`
    : '';

  // Format yesterday's review section
  const yesterdaysReviewSection = yesterdaysReview
    ? `YESTERDAY (${yesterdaysReview.periodKey}):\n${yesterdaysReview.summary}`
    : '';

  // Format menstrual cycle phase section (if tracking)
  const cyclePhaseSection = formatCyclePhaseSection(cyclePhase);

  // Get the appropriate prompt for this tracker type
  const basePrompt = getEventCoachPrompt(trackerType);

  // Build the prompt by replacing placeholders
  const prompt = basePrompt
    .replace('{{guide}}', guide || 'Session Coach')
    .replace('{{goal}}', sessionGoal || 'Make progress on current goals')
    .replace('{{keyContext}}', keyContext || '(No historical context available)')
    .replace('{{cyclePhaseSection}}', cyclePhaseSection)
    .replace('{{todaysPlanSection}}', todaysPlanSection)
    .replace('{{todaysEventsSection}}', todaysEventsSection)
    .replace('{{yesterdaysReviewSection}}', yesterdaysReviewSection)
    .replace('{{previousEvents}}', formattedPreviousEvents)
    .replace('{{newEvent}}', eventContent)
    .replace('{{currentMasterSummary}}', currentMasterSummary || '(No previous entries)');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Event: ${eventContent}` },
        ],
        temperature: 0.7,
        max_tokens: hasMasterSummary(trackerType) ? 1500 : 300,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateEventSuggestion] OpenAI error:', error);
      return { error: 'Failed to generate suggestion' };
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content?.trim();

    if (!rawResponse) {
      return { error: 'Empty response from AI' };
    }

    // Parse response based on tracker type
    if (hasMasterSummary(trackerType)) {
      // Diet/Gym: Extract both MASTER_SUMMARY and COMMENT sections
      const masterSummary = extractSection(rawResponse, 'MASTER_SUMMARY');
      const comment = extractSection(rawResponse, 'COMMENT');

      if (!comment) {
        // Fallback: treat whole response as comment if parsing fails
        return { comment: rawResponse };
      }

      return {
        comment,
        masterSummary: masterSummary || undefined,
      };
    } else {
      // Addiction/General: Extract COMMENT only (or use whole response)
      const comment = extractSection(rawResponse, 'COMMENT') || rawResponse;
      return { comment };
    }
  } catch (error) {
    console.error('[generateEventSuggestion] Error:', error);
    return { error: 'Network error - please try again' };
  }
}

/**
 * Format a date string as relative time
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string as time (e.g., "9:30 AM")
 */
function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format menstrual cycle phase section for prompts
 */
function formatCyclePhaseSection(cyclePhase?: MenstrualCycleInfo): string {
  if (!cyclePhase || !cyclePhase.tracking || !cyclePhase.currentPhase) {
    return '';
  }

  const phaseDescriptions: Record<string, string> = {
    menstrual: 'Menstrual phase - energy typically lower, strength may be reduced 10-20%',
    follicular: 'Follicular phase - energy rising, good recovery, optimal for intensity',
    ovulation: 'Ovulation phase - peak performance window, best for PRs and max efforts',
    luteal: 'Luteal phase - higher RPE (weights feel heavier), metabolism +100-300cal, cravings normal',
  };

  const phaseNotes: Record<string, string[]> = {
    menstrual: [
      'Strength typically 10-20% lower - this is normal',
      'Focus on technique over intensity',
      'Iron-rich foods help with energy',
    ],
    follicular: [
      'Good time for progressive overload',
      'Body recovers well - can push intensity',
      'Carbs utilized efficiently',
    ],
    ovulation: [
      'Best window for max attempts and PRs',
      'Peak strength and coordination',
      'Slight metabolism increase',
    ],
    luteal: [
      'Same weights will feel 10-15% harder - hormonal, not weakness',
      'Recovery is slower - maintain, dont push',
      'Cravings are biological - +100-300cal needs',
      'Magnesium helps (dark chocolate, nuts)',
    ],
  };

  const lines = [
    `=== MENSTRUAL CYCLE PHASE ===`,
    `Current: ${cyclePhase.currentPhase.toUpperCase()} (Day ${cyclePhase.dayOfCycle})`,
    phaseDescriptions[cyclePhase.currentPhase] || '',
    '',
    'NOTES:',
    ...(phaseNotes[cyclePhase.currentPhase] || []).map(note => `- ${note}`),
    '',
  ];

  return lines.join('\n');
}
