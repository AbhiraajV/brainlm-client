/**
 * Shared session content formatting utilities.
 * Produces the rich markdown format that parseSessionLog() in EventRow recognizes:
 *   # Title
 *   **Goal:** ...
 *   **Coach:** ...
 *   ## Session Log
 *   ## Session Analysis
 */

export interface SessionEvent {
  content: string;
  createdAt?: string;
  llmComment?: string;
}

export interface SessionAnalysisInput {
  sessionType: string;
  relevantHistory?: {
    date: string;
    event: string;
    highlight?: string;
  }[];
  patterns?: {
    name: string;
    description: string;
    trend: string;
  }[];
  correlations?: {
    factor: string;
    impact: string;
    direction: string;
  }[];
  context?: string;
  userGoals?: string;
}

export interface SessionContentInput {
  title: string;
  goal?: string;
  guide?: string;
  events?: SessionEvent[];
  analysis?: SessionAnalysisInput;
}

/**
 * Format session content in the rich markdown format recognized by the event feed.
 * This format is detected by parseSessionLog() in EventRow.tsx via:
 *   - Starts with "# " (title)
 *   - Contains "## Session Log"
 */
export function formatSessionContent(input: SessionContentInput): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${input.title}`);
  lines.push('');

  // Goal
  if (input.goal) {
    lines.push(`**Goal:** ${input.goal}`);
    lines.push('');
  }

  // Coach/Guide
  if (input.guide) {
    lines.push(`**Coach:** ${input.guide}`);
    lines.push('');
  }

  // Session Log (events with coach comments)
  if (input.events && input.events.length > 0) {
    lines.push('## Session Log');
    lines.push('');

    for (const event of input.events) {
      lines.push(`- ${event.content}`);
      if (event.llmComment) {
        lines.push(`  - _Coach: ${event.llmComment}_`);
      }
    }
  }

  // Session Analysis
  if (input.analysis) {
    lines.push('');
    lines.push('## Session Analysis');
    lines.push('');

    // Patterns
    if (input.analysis.patterns?.length) {
      lines.push('**Patterns:**');
      for (const pattern of input.analysis.patterns) {
        lines.push(`- **${pattern.name}** (${pattern.trend}): ${pattern.description}`);
      }
      lines.push('');
    }

    // Correlations
    if (input.analysis.correlations?.length) {
      lines.push('**Correlations:**');
      for (const corr of input.analysis.correlations) {
        const arrow = corr.direction === 'positive' ? '\u2191' : '\u2193';
        lines.push(`- ${corr.factor} ${arrow} ${corr.impact}`);
      }
      lines.push('');
    }

    // Context
    if (input.analysis.context) {
      lines.push('**Context:**');
      lines.push(input.analysis.context);
      lines.push('');
    }
  }

  return lines.join('\n');
}
