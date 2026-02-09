/**
 * Comprehensive test script for event suggestion LLM
 * Tests: workouts, diet, smoking, urge tracking, cooking, emotional states
 * Run with: npx tsx scripts/test-event-suggestions.ts
 */

import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

const EVENT_COACH_PROMPT = `You ARE the user's trusted companion for this domain - part memory, part coach, part therapist.

YOUR ROLE: {{guide}}
SESSION CONTEXT: {{goal}}

USER'S PATTERNS & HISTORY:
{{keyContext}}

{{yesterdaysReviewSection}}

{{todaysEventsSection}}

=== DETECT SESSION TYPE ===

TRACKING SESSIONS (workout sets/reps, diet calories/protein, study time):
→ Line 1 MUST show cumulative numbers: "2 sets | 14 reps" or "850 cal | 45g protein"
→ Always calculate totals from THIS SESSION'S EVENTS only
→ Include the actual numbers from each event

PROCESS SESSIONS (cooking, building, creating):
→ Line 1 shows progress: "Step 2 | prep done" or "3 steps | marinating"
→ Track steps completed, not sets/reps
→ Guide them through the next action

SUPPORT SESSIONS (smoking/quit, porn/urges, cravings, anxiety, emotional struggles):
→ Line 1 identifies the trigger: "Trigger: boredom + late night"
→ Be a therapist - warm, understanding, insightful
→ Explain WHY this is happening based on their patterns
→ Give specific coping strategies that work for THEM
→ NEVER count cravings/urges like "2 cravings | 1 resisted" - that's cold and unhelpful

=== OUTPUT FORMAT ===

Respond with exactly 3 lines, plain text, no markdown:

LINE 1: Status (tracking) OR Trigger/State (support)
LINE 2: Insight - WHY this is happening based on their patterns
LINE 3: → Specific actionable suggestion

=== EXAMPLES BY SESSION TYPE ===

TRACKING - Workout first set "squats 270lbs 8 reps":
1 set | 8 reps | squats 270lbs
Starting strong with good weight.
→ Aim for 6-8 reps on set 2

TRACKING - Workout second set "squats 270lbs 6 reps" (previous: 8 reps):
2 sets | 14 reps | squats 270lbs
Normal rep drop on set 2, you're still pushing well.
→ One more set, then move to the next exercise

TRACKING - Workout stopping early:
Session: 3 sets | 22 reps done
You've put in solid work despite how you're feeling.
→ Call it here, stretch and recover - that's still a win

TRACKING - Diet first meal "chicken salad 450 cal 40g protein":
450 cal | 40g protein
Solid start with high protein.
→ Keep this pace for the next meal

TRACKING - Diet second meal (previous: 450 cal):
900 cal | 75g protein total
On track for your goals, good protein ratio.
→ Light dinner around 500 cal to finish strong

SUPPORT - Smoking craving after coffee:
Trigger: morning coffee ritual
This is one of your strongest associations - coffee = cigarette is deeply wired. Breaking this link takes time.
→ Try drinking your coffee in a different spot, or hold something else in your hand

SUPPORT - Smoking craving after argument:
Trigger: conflict with partner
Arguments spike your stress and you reach for what used to calm you down. This is a normal response, not weakness.
→ Text a friend about the argument instead, or write down what you're feeling for 2 mins

SUPPORT - Urge when bored alone at night:
Trigger: boredom + isolation + late night
This is your hardest combo - being alone with nothing to do after 10pm. Your brain is seeking dopamine.
→ Get out of the house right now, even just to walk around the block

SUPPORT - Urge after seeing triggering content:
Trigger: accidental exposure
Seeing something triggering doesn't mean you failed - how you respond now is what matters.
→ Close everything, leave the room, do 20 pushups or take a cold shower

SUPPORT - Binge urge after bad day:
Trigger: work stress + emotional overwhelm
You use food to cope with stress - this is a pattern. The urge will pass if you wait.
→ Set a 20 min timer, have a glass of water, then reassess

SUPPORT - Relapse happened:
Acknowledging the setback
One slip doesn't erase your progress. Shame makes it worse - what matters is what you do next.
→ Don't spiral. Write down what triggered it, then do one small positive thing right now

SUPPORT - Feeling unmotivated/low:
Current state: low energy
This feeling is temporary. Given what's been happening, it makes sense you're drained.
→ Do the smallest possible version of what you planned, or rest guilt-free

PROCESS - Cooking first step "chopped vegetables":
Step 1 | prep started
Vegetables ready - good mise en place.
→ Heat the pan and start on the protein

PROCESS - Cooking "dough too sticky":
Step 3 | troubleshooting dough
This is common for first-time pasta - the flour/egg ratio takes practice.
→ Add flour a tablespoon at a time until it comes together

=== RULES ===
- Plain text only, NO markdown
- For TRACKING: count only from "THIS SESSION'S EVENTS"
- For SUPPORT: focus on triggers, patterns, and coping - not counting
- Line 2 should explain WHY based on their known patterns
- Line 3 must be specific and actionable for THIS person
- Be warm but not cheesy - talk like a wise friend who knows them well
- NEVER output meaningless stats like "0 sets | 0 reps" or "1 craving | resisted 0"
- Don't repeat what you already said (shown as "→ You said:")

THIS SESSION'S EVENTS:
{{previousEvents}}

NEW EVENT:
{{newEvent}}`;

interface TestCase {
  name: string;
  guide: string;
  goal: string;
  keyContext: string;
  todaysEvents?: string;
  yesterdaysReview?: string;
  previousEvents: { content: string; createdAt: string; llmComment?: string }[];
  newEvent: string;
  shouldNotContain?: string[]; // Patterns that should NOT appear
  shouldContain?: string[]; // Patterns that SHOULD appear (at least one)
}

const testCases: TestCase[] = [
  // ==================== WORKOUT TESTS ====================
  {
    name: '💪 Workout: First set (expect: 1 set | 8 reps)',
    guide: 'Workout Coach',
    goal: 'Leg day - squats and lunges',
    keyContext: 'User does 4 sets per exercise typically.',
    previousEvents: [],
    newEvent: 'squats 270lbs 8 reps',
  },
  {
    name: '💪 Workout: Second set (expect: 2 sets | 14 reps)',
    guide: 'Workout Coach',
    goal: 'Leg day',
    keyContext: 'User does 4 sets per exercise.',
    previousEvents: [
      { content: 'squats 270lbs 8 reps', createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
    ],
    newEvent: 'squats 270lbs 6 reps',
  },
  {
    name: '💪 Workout: Stopping early - emotional',
    guide: 'Workout Coach',
    goal: 'Push day',
    keyContext: 'User had a breakup recently. Stress affects workout motivation.',
    previousEvents: [
      { content: 'bench 80kg 8 reps', createdAt: new Date(Date.now() - 20 * 60000).toISOString() },
      { content: 'bench 80kg 6 reps', createdAt: new Date(Date.now() - 15 * 60000).toISOString() },
      { content: 'incline press 60kg 8 reps', createdAt: new Date(Date.now() - 10 * 60000).toISOString() },
    ],
    newEvent: "don't feel like working out anymore",
    shouldNotContain: ['0 sets', '0 reps'],
  },

  // ==================== SMOKING CESSATION TESTS ====================
  {
    name: '🚬 Smoking: First craving of day',
    guide: 'Quit Smoking Coach',
    goal: 'Stay smoke-free, track triggers',
    keyContext: 'Quit 2 weeks ago. Main triggers: after meals, stress, boredom. Has resisted 80% of cravings.',
    previousEvents: [],
    newEvent: 'craving after morning coffee',
    shouldNotContain: ['0 sets', '0 reps', '0 crav'],
  },
  {
    name: '🚬 Smoking: Craving after argument (trigger)',
    guide: 'Quit Smoking Coach',
    goal: 'Stay smoke-free',
    keyContext: 'Arguments with partner are a major trigger. Last relapse was after a fight.',
    previousEvents: [
      { content: 'craving after lunch, resisted', createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    ],
    newEvent: 'huge craving after argument with partner',
    shouldNotContain: ['0 sets', '0 reps'],
  },
  {
    name: '🚬 Smoking: Gave in (relapse)',
    guide: 'Quit Smoking Coach',
    goal: 'Stay smoke-free',
    keyContext: 'Was on day 14. Relapses usually happen during high stress.',
    previousEvents: [
      { content: 'craving at 9am, resisted', createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
      { content: 'craving at 2pm, resisted', createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
    ],
    newEvent: 'gave in and smoked one cigarette',
    shouldNotContain: ['0 sets', '0 reps'],
  },

  // ==================== PORN/URGE TRACKING TESTS ====================
  {
    name: '🔒 Urge tracking: Boredom trigger',
    guide: 'Accountability Coach',
    goal: 'Stay clean, track urges and triggers',
    keyContext: 'Day 12 of streak. Main triggers: boredom, late night, being alone. Usually strongest urges after 10pm.',
    previousEvents: [],
    newEvent: 'feeling urge, bored at home alone',
    shouldNotContain: ['0 sets', '0 reps'],
  },
  {
    name: '🔒 Urge tracking: Late night struggle',
    guide: 'Accountability Coach',
    goal: 'Maintain streak',
    keyContext: 'Late nights are hardest. Has relapsed 3 times after midnight in past month.',
    previousEvents: [
      { content: 'urge at 3pm, distracted myself with walk', createdAt: new Date(Date.now() - 8 * 3600000).toISOString() },
    ],
    newEvent: "it's 11pm and struggling hard",
    shouldNotContain: ['0 sets', '0 reps'],
  },
  {
    name: '🔒 Urge tracking: Relapse logged',
    guide: 'Accountability Coach',
    goal: 'Recovery and awareness',
    keyContext: 'Was on day 8. Relapses trigger shame spirals.',
    previousEvents: [],
    newEvent: 'relapsed, feeling terrible about it',
    shouldNotContain: ['0 sets', '0 reps', '0 day'],
  },

  // ==================== DIET/BINGE EATING TESTS ====================
  {
    name: '🍎 Diet: Normal meal (expect: 450 cal | 40g protein)',
    guide: 'Nutrition Coach',
    goal: 'Stay under 1800 cal, 120g protein',
    keyContext: 'Tends to overeat at dinner. Skipping meals leads to binges.',
    previousEvents: [],
    newEvent: 'grilled chicken salad 450 cal 40g protein',
  },
  {
    name: '🍎 Diet: Binge urge',
    guide: 'Nutrition Coach',
    goal: 'Mindful eating, avoid binges',
    keyContext: 'Binges triggered by: skipped meals, emotional stress, loneliness. Last binge was 3 days ago.',
    previousEvents: [
      { content: 'oatmeal 350 cal', createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
    ],
    newEvent: 'want to eat everything in the fridge right now',
    shouldNotContain: ['0 cal', '0 sets', '0 reps'],
  },
  {
    name: '🍎 Diet: Emotional eating after bad day',
    guide: 'Nutrition Coach',
    goal: 'Healthy relationship with food',
    keyContext: 'Uses food to cope with stress. Work stress is main trigger.',
    previousEvents: [
      { content: 'lunch salad 400 cal', createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    ],
    newEvent: 'bad day at work, ate a whole pizza',
    shouldNotContain: ['0 cal', '0 sets'],
  },

  // ==================== COOKING SESSION TESTS ====================
  {
    name: '🍳 Cooking: First step',
    guide: 'Cooking Assistant',
    goal: 'Make chicken stir fry',
    keyContext: 'Intermediate cook. Prefers less spicy.',
    previousEvents: [],
    newEvent: 'chopped all vegetables',
    shouldNotContain: ['0 sets', '0 reps'],
  },
  {
    name: '🍳 Cooking: Recipe going wrong',
    guide: 'Cooking Assistant',
    goal: 'Make pasta from scratch',
    keyContext: 'First time making fresh pasta.',
    previousEvents: [
      { content: 'mixed flour and eggs', createdAt: new Date(Date.now() - 15 * 60000).toISOString() },
      { content: 'kneaded dough for 10 mins', createdAt: new Date(Date.now() - 10 * 60000).toISOString() },
    ],
    newEvent: 'dough is too sticky, not coming together',
    shouldNotContain: ['0 sets', '0 reps'],
  },

  // ==================== STUDY SESSION TESTS ====================
  {
    name: '📚 Study: Focus dropping',
    guide: 'Study Coach',
    goal: 'Prepare for AWS exam',
    keyContext: 'Focus usually drops after 90 mins. Networking is weakest topic.',
    previousEvents: [
      { content: 'studied IAM for 45 mins', createdAt: new Date(Date.now() - 60 * 60000).toISOString() },
      { content: 'studied VPC for 30 mins', createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
    ],
    newEvent: "can't focus anymore, mind wandering",
    shouldNotContain: ['0 hrs', '0 min', '0 sets'],
  },

  // ==================== MEDITATION/MINDFULNESS TESTS ====================
  {
    name: '🧘 Meditation: Anxious session',
    guide: 'Mindfulness Coach',
    goal: 'Daily meditation practice',
    keyContext: 'Struggles with racing thoughts. Anxiety spikes in mornings.',
    previousEvents: [],
    newEvent: 'tried to meditate but mind racing, gave up after 3 mins',
    shouldNotContain: ['0 sets', '0 reps'],
  },
];

async function callLLM(testCase: TestCase): Promise<string> {
  const formattedPreviousEvents = testCase.previousEvents.length > 0
    ? testCase.previousEvents
        .map((e, i) => {
          let entry = `${i + 1}. ${e.content}`;
          if (e.llmComment) {
            entry += `\n   → You said: ${e.llmComment}`;
          }
          return entry;
        })
        .join('\n\n')
    : '(none - this is the first event)';

  const todaysEventsSection = testCase.todaysEvents
    ? `TODAY'S EVENTS (context only):\n${testCase.todaysEvents}`
    : '';

  const yesterdaysReviewSection = testCase.yesterdaysReview
    ? `YESTERDAY'S SUMMARY (context only):\n${testCase.yesterdaysReview}`
    : '';

  const prompt = EVENT_COACH_PROMPT
    .replace('{{guide}}', testCase.guide)
    .replace('{{goal}}', testCase.goal)
    .replace('{{keyContext}}', testCase.keyContext)
    .replace('{{todaysEventsSection}}', todaysEventsSection)
    .replace('{{yesterdaysReviewSection}}', yesterdaysReviewSection)
    .replace('{{previousEvents}}', formattedPreviousEvents)
    .replace('{{newEvent}}', testCase.newEvent);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Event: ${testCase.newEvent}` },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('COMPREHENSIVE EVENT SUGGESTION TEST SUITE');
  console.log('='.repeat(70));
  console.log('');

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const testCase of testCases) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`Event: "${testCase.newEvent}"`);
    console.log(`Previous: ${testCase.previousEvents.length} events`);

    try {
      const response = await callLLM(testCase);

      console.log(`\nRESPONSE:\n${response}`);

      // Check for markdown (bad)
      const hasMarkdown = response.includes('---') || response.includes('**') || response.includes('##');
      if (hasMarkdown) {
        console.log(`\n❌ FAIL: Contains markdown formatting`);
        failed++;
        failures.push(`${testCase.name}: Contains markdown`);
        continue;
      }

      // Check shouldNotContain (with word boundaries)
      let failedCheck = false;
      if (testCase.shouldNotContain) {
        for (const pattern of testCase.shouldNotContain) {
          // Use word boundary to avoid false positives like "350 cal" matching "0 cal"
          const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          if (regex.test(response)) {
            console.log(`\n❌ FAIL: Contains forbidden pattern "${pattern}"`);
            failed++;
            failures.push(`${testCase.name}: Contains "${pattern}"`);
            failedCheck = true;
            break;
          }
        }
      }

      if (failedCheck) continue;

      // Check shouldContain (at least one)
      if (testCase.shouldContain) {
        const hasAny = testCase.shouldContain.some(p =>
          response.toLowerCase().includes(p.toLowerCase())
        );
        if (!hasAny) {
          console.log(`\n❌ FAIL: Missing expected patterns: ${testCase.shouldContain.join(', ')}`);
          failed++;
          failures.push(`${testCase.name}: Missing expected content`);
          continue;
        }
      }

      console.log(`\n✅ PASS`);
      passed++;

    } catch (error) {
      console.log(`\n❌ ERROR: ${error}`);
      failed++;
      failures.push(`${testCase.name}: Error - ${error}`);
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
  console.log(`${'='.repeat(70)}`);

  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
}

runTests().catch(console.error);
