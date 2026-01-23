#!/usr/bin/env npx tsx
/**
 * Session Events Adaptive Tracking Test Harness
 *
 * Tests the EVENT_COACH_PROMPT's adaptive cumulative tracking behavior using mock data.
 * No database connection needed - uses simulated sessions.
 *
 * Usage:
 *   npm run test:events                              # Run all scenarios
 *   npm run test:events -- --scenario diet           # Run specific scenario
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// The prompt to test (should match event-suggestion.actions.ts)
const EVENT_COACH_PROMPT = `You ARE the user's memory for this domain. You know everything they know about their history in this area.

YOUR ROLE: {{guide}}
SESSION CONTEXT: {{goal}}

THE USER'S DOMAIN KNOWLEDGE:
{{keyContext}}

{{yesterdaysReviewSection}}

{{todaysEventsSection}}

When they log an event, respond as if you ARE their brain - with perfect recall of their history. You're their knowledgeable self talking, not a coach giving advice.

=== OUTPUT FORMAT (3 SECTIONS) ===

Your response MUST have exactly 3 sections, minimal and glanceable:

**SECTION 1 - QUANTITATIVE (one line)**
Calculate cumulative totals from ALL previous events + new event.
Format: metric1 | metric2 | metric3 (separated by |)
- Diet: 850/1400 cal | 65g protein | 30g fat | 90g carbs
- Workout: 6 sets | 48 reps | 2 exercises
- Study: 2.5 hrs | 3 topics | 1 practice test
- Track whatever metrics are relevant to the session context

**SECTION 2 - QUALITATIVE (1-2 sentences)**
Brief observation about what's happening based on:
- Today's events pattern
- User's known patterns from their history
- Why this might be happening (stress eating? skipped meal? tired?)

**SECTION 3 - NEXT (one short line)**
Start with "→" - one small actionable suggestion

=== HOW TO CALCULATE TOTALS ===
1. Look at PREVIOUS EVENTS THIS SESSION
2. Extract numeric values from EACH event
3. ADD them together + new event values
4. Show cumulative total

Example: Previous events have 600 cal + 800 cal, new event is 100 cal → Total: 1500 cal

=== EXAMPLE OUTPUTS ===

Diet session:
---
850/1400 cal | 65g protein | 32g fat

Heavy lunch after skipping breakfast - your pattern shows overeating when meals are skipped.

→ Light 300 cal dinner with 30g protein to hit target
---

Workout session:
---
6 sets | 48 reps | bench 87.5kg PR

Sleep was 6hrs last night - you typically struggle on set 4+ with poor sleep.

→ Skip the 4th set on incline if form breaks down
---

Study session:
---
2.5 hrs focused | networking 65% | IAM 80%

Focus dropped after 2 hrs - matches your pattern. Networking still weakest area.

→ 15 min break then 30 mins on VPC subnets
---

=== RULES ===
- BE MINIMAL - no fluff, no cheerleading
- Quantitative line: just numbers and units separated by |
- Qualitative: 1-2 sentences MAX about patterns/causes
- Next: starts with → and is ONE actionable item
- Reference TODAY'S EVENTS to understand daily context

PREVIOUS EVENTS THIS SESSION:
{{previousEvents}}

NEW EVENT JUST LOGGED:
{{newEvent}}

Respond with exactly 3 sections: Quantitative | Qualitative | → Next`;

// Test Scenarios
interface MockEvent {
  content: string;
  createdAt: string;
}

interface TestScenario {
  name: string;
  description: string;
  sessionTitle: string;
  sessionGoal: string;
  guide: string;
  keyContext: string;
  events: MockEvent[];
}

function minutesAgo(mins: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - mins);
  return d.toISOString();
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'diet-with-target',
    description: 'User sets a calorie target - should track with percentage and give diet advice',
    sessionTitle: 'Diet Log',
    sessionGoal: 'Stay within 1400 cal today, hit 100g protein',
    guide: 'Nutrition Tracker',
    keyContext: `User typically eats:
- Breakfast: 300-400 cal
- Lunch: 400-500 cal
- Dinner: 400-500 cal
- Snacks: 100-200 cal
Average protein intake: 80-100g
Weight goal: lose 5 lbs this month
Pattern: tends to overeat on weekends
Last week averaged 1650 cal/day`,
    events: [
      { content: 'Breakfast: Greek yogurt with berries, 350 cal, 20g protein', createdAt: minutesAgo(120) },
      { content: 'Lunch: Grilled chicken salad, 450 cal, 35g protein', createdAt: minutesAgo(60) },
      { content: 'Snack: Protein bar, 200 cal, 15g protein', createdAt: minutesAgo(30) },
    ],
  },
  {
    name: 'diet-overeating',
    description: 'User is eating high calorie - should warn and suggest based on patterns',
    sessionTitle: 'Diet Log',
    sessionGoal: 'Stay within 1800 cal today',
    guide: 'Nutrition Tracker',
    keyContext: `User patterns:
- Overeats when stressed (identified 5 times last month)
- High calorie breakfasts lead to overshooting daily target
- Does well when starting with protein-heavy breakfast
- Last 3 days: 2100, 1950, 2200 cal (all over target)
- Weak spot: afternoon snacking when bored`,
    events: [
      { content: 'Breakfast: Pancakes with syrup and bacon, 850 cal', createdAt: minutesAgo(120) },
      { content: 'Lunch: Burger and fries, 1100 cal', createdAt: minutesAgo(60) },
    ],
  },
  {
    name: 'workout-tracking',
    description: 'Chest workout - should track sets/reps and suggest weight progression',
    sessionTitle: 'Chest Day',
    sessionGoal: 'Upper body workout focusing on chest',
    guide: 'Gym Coach',
    keyContext: `Bench press history:
- Last week: 85kg x 5 x 3 (clean)
- Two weeks ago: 82.5kg x 5 x 3
- Three weeks ago: 80kg x 5 x 3
Progression pattern: +2.5kg when all reps are clean
Current chest routine: bench, incline dumbbell, cable flies
Note: struggles on 4th set when sleep is poor
Last night sleep: 6 hours`,
    events: [
      { content: 'Bench press: 87.5kg x 5 x 3 sets', createdAt: minutesAgo(45) },
      { content: 'Incline dumbbell press: 30kg x 8 x 3 sets', createdAt: minutesAgo(30) },
      { content: 'Cable flies: 15kg x 12 x 3 sets', createdAt: minutesAgo(15) },
    ],
  },
  {
    name: 'study-session',
    description: 'Study session - should track time and give focus advice',
    sessionTitle: 'AWS Certification Study',
    sessionGoal: 'Study for AWS Solutions Architect exam - 3 hrs target',
    guide: 'Study Partner',
    keyContext: `Studying for AWS SA Professional
- Last week: 8 hrs total study time
- Covered: EC2, S3, VPC basics
- Weak areas: networking, IAM policies
- Pattern: focus drops after 2 hrs without break
- Best study times: morning 9-11am
- Exam date: 2 weeks away`,
    events: [
      { content: 'Studied IAM policies for 1.5 hrs', createdAt: minutesAgo(120) },
      { content: 'Practice exam - networking section, 45 mins, scored 65%', createdAt: minutesAgo(60) },
    ],
  },
  {
    name: 'hydration-tracking',
    description: 'Water intake - should track glasses and remind about patterns',
    sessionTitle: 'Hydration Log',
    sessionGoal: 'Drink 8 glasses of water today',
    guide: 'Health Tracker',
    keyContext: `Daily water goal: 8 glasses (64 oz)
- Yesterday: only 5 glasses
- Pattern: forgets to drink water 2-5pm
- Drinks more when water bottle is visible
- Headaches correlate with <6 glasses days
- Had headache yesterday`,
    events: [
      { content: 'Morning: 2 glasses of water', createdAt: minutesAgo(180) },
      { content: 'With lunch: 1 glass water', createdAt: minutesAgo(60) },
      { content: 'Afternoon: 2 glasses', createdAt: minutesAgo(30) },
    ],
  },
  {
    name: 'running-workout',
    description: 'Cardio session - should track distance/pace and compare to history',
    sessionTitle: 'Morning Run',
    sessionGoal: 'Cardio workout - aim for 5km',
    guide: 'Running Coach',
    keyContext: `Running history:
- Last week: 5km in 28 mins (avg pace 5:36/km)
- PR: 5km in 25:30 (set 3 weeks ago)
- Avg pace trending: 5:45 → 5:36 → 5:30
- Pattern: faster after good sleep, slower when legs tired from gym
- Yesterday: leg day at gym`,
    events: [
      { content: 'Warm up jog: 1km in 6 mins', createdAt: minutesAgo(45) },
      { content: 'Main run: 4km in 22 mins', createdAt: minutesAgo(20) },
    ],
  },
  {
    name: 'sleep-tracking',
    description: 'Sleep log - should track hours and identify patterns',
    sessionTitle: 'Sleep Log',
    sessionGoal: 'Track sleep quality this week',
    guide: 'Sleep Tracker',
    keyContext: `Sleep patterns:
- Target: 7-8 hours
- This week so far: 6hrs, 5.5hrs, 6hrs (Mon-Wed)
- Pattern: poor sleep after screen time past 10pm
- Pattern: better sleep after evening walk
- Last night: was on phone until 11:30pm
- Correlation: <6hrs sleep = poor gym performance next day`,
    events: [
      { content: 'Woke up at 6am, slept at 12:30am = 5.5 hrs', createdAt: minutesAgo(60) },
    ],
  },
  {
    name: 'expense-tracking',
    description: 'Budget tracking - should track spending and warn about patterns',
    sessionTitle: 'Daily Expenses',
    sessionGoal: 'Stay within $50/day budget',
    guide: 'Budget Tracker',
    keyContext: `Budget: $50/day, $350/week
- This week so far: $65, $45, $80 (over budget 2/3 days)
- Pattern: overspends on food delivery when tired
- Pattern: impulse buys on Amazon after 9pm
- Weak spot: coffee shops ($6-8 per visit)
- Monthly savings goal: $500`,
    events: [
      { content: 'Morning coffee at Starbucks: $7', createdAt: minutesAgo(180) },
      { content: 'Lunch delivery: $22', createdAt: minutesAgo(60) },
      { content: 'Amazon purchase: $35', createdAt: minutesAgo(30) },
    ],
  },
];

// LLM Call
async function callLLM(prompt: string, userMessage: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;

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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI error:', await response.json().catch(() => ({})));
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('LLM call error:', error);
    return null;
  }
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${Math.floor(diffMins / 60)}h ago`;
}

async function runScenario(scenario: TestScenario): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`${scenario.description}`);
  console.log(`Session: "${scenario.sessionTitle}" | Goal: "${scenario.sessionGoal}"`);
  console.log('═'.repeat(80));

  for (let i = 0; i < scenario.events.length; i++) {
    const event = scenario.events[i];
    const previousEvents = scenario.events.slice(0, i);

    const formattedPreviousEvents =
      previousEvents.length > 0
        ? previousEvents.map((e, idx) => `${idx + 1}. ${e.content} (${formatRelativeTime(e.createdAt)})`).join('\n')
        : '(none - this is the first event)';

    const prompt = EVENT_COACH_PROMPT.replace('{{guide}}', scenario.guide)
      .replace('{{goal}}', scenario.sessionGoal)
      .replace('{{keyContext}}', scenario.keyContext)
      .replace('{{todaysEventsSection}}', '')
      .replace('{{yesterdaysReviewSection}}', '')
      .replace('{{previousEvents}}', formattedPreviousEvents)
      .replace('{{newEvent}}', event.content);

    console.log(`\n  📝 Event ${i + 1}: "${event.content}"`);

    const response = await callLLM(prompt, `Event: ${event.content}`);

    if (!response) {
      console.log(`  ❌ Failed to get LLM response`);
      continue;
    }

    // Display response with indentation
    console.log(`  ${'─'.repeat(70)}`);
    response.split('\n').forEach(line => {
      console.log(`  ${line}`);
    });
    console.log(`  ${'─'.repeat(70)}`);
  }
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           SESSION EVENTS ADAPTIVE TRACKING TEST HARNESS                        ║');
  console.log('║                    Manual Review - Read Outputs Below                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  console.log(`
WHAT TO CHECK IN EACH RESPONSE:
  ✓ Running total line at START (Session: X or Running: X)
  ✓ Data-driven advice (references specific numbers, dates, patterns)
  ✓ Actionable suggestions based on user's history
  ✓ No empty cheerleading (no "Great job!" without substance)
`);

  if (!OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not set');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let scenarioFilter: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) {
      scenarioFilter = args[i + 1];
      i++;
    }
  }

  const scenarios = scenarioFilter
    ? TEST_SCENARIOS.filter((s) => s.name.toLowerCase().includes(scenarioFilter!.toLowerCase()))
    : TEST_SCENARIOS;

  if (scenarios.length === 0) {
    console.error(`No scenarios matching: ${scenarioFilter}`);
    console.log('Available:', TEST_SCENARIOS.map((s) => s.name).join(', '));
    process.exit(1);
  }

  console.log(`Running ${scenarios.length} scenario(s)...`);

  for (const scenario of scenarios) {
    await runScenario(scenario);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('DONE - Review outputs above for quality');
  console.log('═'.repeat(80));
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
