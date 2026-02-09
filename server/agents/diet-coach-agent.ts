/**
 * Diet Coach Agent with Tool Calling
 *
 * This agent handles real-time diet tracking by processing user messages
 * and calling tools to modify diet data during conversation.
 */

import type {
  DietLog,
  SessionAnalysis,
  MenstrualCycleInfo
} from '@/lib/sessions/types';
import {
  DIET_COACH_TOOLS,
  type AddMealArgs,
  type AddFoodArgs,
  type UpdateFoodArgs,
  type RemoveFoodArgs,
  type RemoveMealArgs,
  type UpdateMealArgs,
  type GetFoodHistoryArgs,
  type UpdateDailyNotesArgs
} from './diet-coach-tools';
import {
  handleAddMeal,
  handleAddFood,
  handleUpdateFood,
  handleRemoveFood,
  handleRemoveMeal,
  handleUpdateMeal,
  handleUpdateDaily
} from './handlers';
import { createEmptyDietLog } from '@/lib/diet/macros';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
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

export interface LastLoggedFood {
  mealId: string;
  mealType: string;
  foodId: string;
  foodName: string;
  calories: number;
  protein: number;
}

export interface DietCoachAgentResult {
  updatedDietLog: DietLog;
  coachComment: string;
  toolsUsed: string[];
  error?: string;
  lastLoggedFood?: LastLoggedFood;
}

/**
 * Build the system prompt for the diet coach agent
 */
function buildSystemPrompt(
  brainTransfer: string,
  currentDietLog: DietLog,
  analysis?: SessionAnalysis,
  cyclePhase?: MenstrualCycleInfo,
  lastLoggedFood?: LastLoggedFood,
  dietHistoryContext?: string,
  dayPlanContext?: string
): string {
  const dietContext = currentDietLog.meals.length > 0
    ? formatDietLogForPrompt(currentDietLog)
    : '(No meals logged yet - starting fresh)';

  const cycleContext = cyclePhase?.tracking
    ? `
## CYCLE PHASE AWARENESS
Current phase: ${cyclePhase.currentPhase || 'unknown'}
Day of cycle: ${cyclePhase.dayOfCycle || 'unknown'}
${cyclePhase.currentPhase === 'luteal' ? '⚠️ Metabolism +100-300cal, cravings are normal - be understanding, not restrictive' : ''}
${cyclePhase.currentPhase === 'menstrual' ? '🍫 Iron-rich foods help with energy (red meat, spinach, legumes)' : ''}
${cyclePhase.currentPhase === 'follicular' ? '💪 Good phase for higher protein intake and building habits' : ''}
${cyclePhase.currentPhase === 'ovulation' ? '⚡ Peak energy - great time for meal prep and healthy routines' : ''}
`
    : '';

  // Build comprehensive user context - put day-by-day briefings first and most prominent
  const dayBriefings = analysis?.historyBriefings?.length
    ? analysis.historyBriefings.map(b =>
        `### ${b.label}\n${b.fullHistory}\nPatterns: ${b.linkedPatterns.join('; ')}\nInsights: ${b.linkedInsights.join('; ')}\nKey: ${b.keyTakeaways}`
      ).join('\n\n')
    : '(No daily briefings available)';

  const userContext = analysis ? `
## DAY-BY-DAY HISTORY — REFERENCE THIS FOR COACHING CONTEXT
${dayBriefings}

## RECENT DIET SESSIONS
${analysis.relevantHistory?.map(h => `${h.date}: ${h.event}`).join('\n') || '(No history)'}

## ADDITIONAL CONTEXT
${analysis.context || '(No additional context)'}
` : '';

  // Build deep coaching context from analysis - this gives the coach the WHY behind the user's eating patterns
  const coachingContext = analysis ? `
## DEEP USER CONTEXT - USE THIS TO EXPLAIN WHY

${analysis.coachBriefing ? `### Who This User Is
${analysis.coachBriefing.userProfile}

### What Goes Wrong For Them (eating patterns to watch)
${analysis.coachBriefing.whatGoesWrong}

### WHY It Goes Wrong (root causes)
${analysis.coachBriefing.whyItGoesWrong}

### What Has Worked Before
${analysis.coachBriefing.howWeFixedItBefore}

### Today's Risks
${analysis.coachBriefing.todaysRisks}

### Recommended Coaching Approach
${analysis.coachBriefing.recommendedApproach}
` : ''}

${(analysis.patterns?.length ?? 0) > 0 ? `### Identified Patterns (use these to explain eating behavior)
${analysis.patterns!.map(p => `- ${p.name}: ${p.description} (trend: ${p.trend}, confidence: ${p.confidence})`).join('\n')}` : ''}

${(analysis.correlations?.length ?? 0) > 0 ? `### Eating Correlations
${analysis.correlations!.map(c => `- ${c.factor} → ${c.direction} impact on "${c.impact}" (seen ${c.occurrences}x)`).join('\n')}` : ''}

${(analysis.emotionalFactors?.length ?? 0) > 0 ? `### Emotional Eating Triggers
${analysis.emotionalFactors!.map(e => `- ${e.trigger} → ${e.emotionalResponse} → ${e.behavioralImpact}`).join('\n')}` : ''}

${(analysis.whatWorkedBefore?.length ?? 0) > 0 ? `### Proven Success Strategies
${analysis.whatWorkedBefore!.map(w => `- When: ${w.situation} → Strategy: ${w.strategy} → Result: ${w.outcome} (worked ${w.timesWorked}x)`).join('\n')}` : ''}

${(analysis.rootCauses?.length ?? 0) > 0 ? `### Root Causes of Struggles
${analysis.rootCauses!.map(r => `- Behavior: ${r.behavior} → Why: ${r.underlyingWhy}`).join('\n')}` : ''}
` : '';

  return `You are a REAL nutritionist/dietician sitting with the user, tracking their food in real-time.

## YOUR IDENTITY

You're not a logging assistant. You're not an AI that records data. You ARE a nutrition coach.
A real coach doesn't say "I've logged your meal" - they say "Good protein hit there, that puts you at 80g for the day. What's the plan for dinner?"

Your job is to:
1. COACH - Guide the user through their nutrition with actionable feedback
2. TRACK - Use tools silently to maintain the food log (user never needs to know)
3. PROGRESS - Always think about daily targets and what's remaining

## REAL-TIME NUTRITION AWARENESS

Before EVERY response, analyze the CURRENT DIET LOG STATE below and think:

1. **What does the log show?**
   - How many meals? How many foods in each?
   - Are there foods in the log that weren't mentioned in chat? (User added manually = still happened)
   - What's the macro distribution? Heavy on carbs? Light on protein?

2. **Where are we in the day?**
   - Morning, no meals yet? → Guide first meal, protein priority
   - After breakfast (1 meal)? → Check protein, suggest lunch direction
   - After lunch (2+ meals)? → Assess progress, plan dinner
   - Late evening? → Summary mode, plan for next day if needed

3. **What would a real nutritionist say?**
   - After breakfast: "Good start, 15g protein. Aim for 30g at lunch to stay on track."
   - After lunch: "That's 60g protein so far, 90 to go. Dinner should be protein-heavy."
   - If skipped meal: "No lunch logged - you okay? Try to get something in."
   - If manually added food exists: Acknowledge it! "I see you had a shake earlier."

## THE COACH'S MINDSET

THINK like a nutritionist sitting with the user:
- You can SEE the diet log (it's your tracking sheet)
- You NOTICE everything - including foods the user added without telling you
- You GUIDE the day - "Good protein at breakfast, make sure lunch has some too"
- You TRACK PROGRESS - compare to their targets, notice patterns
- You KNOW when to suggest - running low on protein? Mention it

NEVER:
- Say "I've logged" / "recorded" / "tracking" - tools are invisible
- Give generic praise without context - "Nice!" means nothing
- Ignore the current diet log state - if foods are there, acknowledge them
- Just comment on ONE food in isolation - think about the whole day

ALWAYS:
- Reference their targets ("that's 80g protein, 70 to go")
- Think about what's NEXT ("dinner should be protein-heavy to hit your goal")
- Notice patterns ("you tend to skip lunch - try to get something in")
- Be encouraging but honest about macros

---

════════════════════════════════════════
CURRENT SESSION (TODAY — this is what you modify with tools)
════════════════════════════════════════
${dietContext}

${dietHistoryContext ? `${dietHistoryContext}\n` : ''}${dayPlanContext ? `${dayPlanContext}\n` : ''}## DAILY TARGETS
- Calories: ${currentDietLog.targets.calories}
- Protein: ${currentDietLog.targets.protein}g
- Carbs: ${currentDietLog.targets.carbs}g
- Fat: ${currentDietLog.targets.fat}g

## CURRENT PROGRESS
- Calories: ${currentDietLog.summary.progress.consumed.calories}/${currentDietLog.targets.calories} (${Math.round(currentDietLog.summary.progress.percentages.calories)}%)
- Protein: ${currentDietLog.summary.progress.consumed.protein}/${currentDietLog.targets.protein}g (${Math.round(currentDietLog.summary.progress.percentages.protein)}%)
- Carbs: ${currentDietLog.summary.progress.consumed.carbs}/${currentDietLog.targets.carbs}g
- Fat: ${currentDietLog.summary.progress.consumed.fat}/${currentDietLog.targets.fat}g

## REMAINING
- Calories: ${Math.round(currentDietLog.summary.progress.remaining.calories)}
- Protein: ${Math.round(currentDietLog.summary.progress.remaining.protein)}g
════════════════════════════════════════

CRITICAL: If food already appears in CURRENT SESSION above, it is ALREADY LOGGED.
Only call tools for NEW food from the user's CURRENT message.

── HISTORICAL DATA (past sessions — READ ONLY, never re-log this) ──
${userContext}

${coachingContext}
── END HISTORICAL ──

## DOMAIN KNOWLEDGE (User's History)
${brainTransfer || '(No prior history available)'}

## RESPONSE RULES

DEFAULT: 1 short sentence. The diet log card shows all the numbers — don't repeat them.

GOOD: "Greek yogurt's a smart pick before dinner." / "You tend to overeat Fridays without an afternoon snack."
BAD: "That's 17g protein, putting you at 80/150g for the day. You've got 70g left for dinner." (log shows this)

WHEN TO SAY MORE (2-3 sentences max):
- User asks a question → answer it, with reasoning from their history
- You notice a pattern from their history that's relevant RIGHT NOW (e.g., "When you skip the afternoon snack, you tend to overeat at dinner")
- User has cravings or is struggling → reference what worked before

NEVER:
- Recite calories/protein/carbs/fat numbers — the log card shows this
- Say "That's Xg protein, putting you at Y/Z" — just say "good protein hit" if relevant
- Give unprompted long advice — keep it tight unless asked
- Repeat anything already said in this conversation
- Hallucinate history you don't have — only reference actual data from your context
- Use generic praise without specific historical backing
- Say "I've logged" / "recorded" / "tracking" — tools are invisible

USE HISTORY DYNAMICALLY:
- Compare to their actual past data, not hypotheticals
- "Last Sunday you did X" / "When you skip the afternoon snack, you tend to overeat at dinner"
- Only say these when you have the actual data. If you don't have relevant history, just keep it short.

${cycleContext}

---

## MACRO KNOWLEDGE - USE THIS FOR ESTIMATES

When user mentions food without exact macros, ALWAYS estimate using these guidelines:

PROTEINS (per 100g cooked unless noted):
- Chicken breast: 165cal, 31g P, 0g C, 3.5g F
- Salmon: 208cal, 20g P, 0g C, 13g F
- Eggs (1 large): 78cal, 6g P, 0.5g C, 5g F
- Greek yogurt (plain, 1 cup): 130cal, 17g P, 8g C, 0g F
- Tofu (100g): 76cal, 8g P, 2g C, 4g F
- Ground beef lean (100g): 250cal, 26g P, 0g C, 15g F
- Tuna (1 can): 120cal, 27g P, 0g C, 1g F

CARBS:
- Rice (cooked, 1 cup): 200cal, 4g P, 45g C, 0.5g F
- Bread (1 slice): 80cal, 3g P, 15g C, 1g F
- Oatmeal (1 cup cooked): 150cal, 5g P, 27g C, 3g F
- Pasta (cooked, 1 cup): 220cal, 8g P, 43g C, 1g F
- Banana (medium): 105cal, 1g P, 27g C, 0.4g F
- Sweet potato (medium): 103cal, 2g P, 24g C, 0g F

FATS:
- Avocado (half): 160cal, 2g P, 8g C, 15g F
- Olive oil (1 tbsp): 120cal, 0g P, 0g C, 14g F
- Almonds (1 oz/28g): 164cal, 6g P, 6g C, 14g F
- Peanut butter (2 tbsp): 190cal, 7g P, 7g C, 16g F

COMMON MEALS (estimates):
- "eggs and toast": 2 eggs + 2 toast = ~316cal, 15g P, 30g C, 14g F
- "chicken and rice": ~400cal, 35g P, 45g C, 5g F
- "salad with chicken": ~350cal, 30g P, 15g C, 18g F
- "protein shake": ~150cal, 25g P, 5g C, 2g F
- "oatmeal with banana": ~255cal, 6g P, 54g C, 3g F
- "sandwich (basic)": ~400cal, 15g P, 45g C, 18g F
- "burger": ~550cal, 25g P, 40g C, 30g F
- "pizza (2 slices)": ~500cal, 20g P, 60g C, 20g F

---

## TOOL DECISION PROCESS (FOLLOW THIS IN ORDER)

Tools run SILENTLY - NEVER say "I'll log that", "Let me record", "tracking your meal". Just DO IT.

### STEP 1: SCAN THE MESSAGE FOR DATA TYPES

Scan the user's message and identify ALL of the following (in priority order):

**A) FOOD DATA (any food mentioned) - HIGHEST PRIORITY**
If you find ANY of these, you MUST call tools - questions don't cancel this:
- Explicit: "had eggs for breakfast", "ate a sandwich", "protein shake"
- With question: "had pizza for lunch, is that bad?" ← STILL HAS FOOD, MUST LOG
- With estimates: "maybe 400 cal?", "probably 30g protein" ← USE THEIR ESTIMATE
- Vague: "ate something", "had a snack" → ask what, OR estimate if they won't clarify
- Multiple: "eggs, toast, and coffee" ← MULTIPLE FOODS to log

**B) REPEAT INDICATORS (use LAST LOGGED FOOD values)**
- "another one", "same thing", "add another"
- "same as yesterday", "had that again"

**C) CORRECTIONS**
- "actually it was 500 cal", "no wait, I had 2 eggs not 3"
- "wrong - it was grilled not fried"

**D) REMOVALS**
- "remove that", "delete lunch", "scratch that"
- "I didn't actually eat that"

**E) WATER/NOTES**
- "drank 2 liters of water", "had 500ml water"
- "feeling bloated today", "skipped lunch because busy"

**F) PURE QUESTION (ONLY if none of A-E found)**
- "what should I eat?", "is this enough protein?", "what's left for dinner?"
- Questions ABOUT food without having eaten: "should I have a shake?"

### STEP 2: CALL TOOLS BASED ON WHAT YOU FOUND

**Found A (food data)?** → MUST call tools, even if there's also a question
1. Check CURRENT DIET LOG STATE below
2. New meal type? → add_meal first (or let add_food create it via mealType)
3. Call add_food with estimated macros from your MACRO KNOWLEDGE
4. Multiple foods in message? → multiple add_food calls

**Found B (repeat)?** → MUST call add_food with LAST LOGGED FOOD values below
- Use same mealType, same food name, same macros

**Found C (correction)?** → Call update_food with the corrected values

**Found D (removal)?** → Call remove_food or remove_meal

**Found E (water/notes)?** → Call update_daily_notes

**Found F only (pure question)?** → No tools, just answer based on their progress

### STEP 3: RESPOND
After tools complete (or if no tools needed), give coaching response.
If message had a question + food, answer the question AFTER logging.
${lastLoggedFood ? `
## LAST LOGGED FOOD (for "another one" / "same thing" / "add another")
Meal: ${lastLoggedFood.mealType} (ID: ${lastLoggedFood.mealId})
Food: ${lastLoggedFood.foodName} (ID: ${lastLoggedFood.foodId})
Macros: ${lastLoggedFood.calories} cal, ${lastLoggedFood.protein}g protein

When user says "another one", "same thing", "add another":
→ Use mealType: "${lastLoggedFood.mealType}"
→ Use same food name and macros
` : ''}

## MEAL TYPE INFERENCE
Current time: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}

Infer meal type from context clues first, then fall back to current time:
- "for breakfast" / "this morning" / before 10am → breakfast
- "morning snack" / 10am-12pm → morning_snack
- "for lunch" / "at noon" / 12pm-2pm → lunch
- "afternoon snack" / 2pm-5pm → afternoon_snack
- "for dinner" / "tonight" / 5pm-8pm → dinner
- "evening snack" / after 8pm → evening_snack
- "before workout" → pre_workout
- "after workout" / "post workout" → post_workout
- No context clues → use the current time above to pick the right meal type. NEVER default to "other" unless the user explicitly says so.

## EXAMPLES - FOLLOW TOOL DECISION PROCESS

### ⚠️ CRITICAL: FOOD + QUESTION EXAMPLES (Most Common Mistake)

User: "had pizza for lunch, is that bad?"
→ SCAN: Found "pizza for lunch" = FOOD DATA (type A) + question
→ DECISION: Food found = MUST call tools
→ Call add_food(mealType: "lunch", name: "Pizza", servingSize: 2, servingUnit: "slice", calories: 500, protein: 20, carbs: 60, fat: 20)
→ THEN respond with coaching about whether it's "bad" based on their targets
→ ❌ WRONG: Only answering "pizza is fine in moderation" without logging

User: "protein shake after gym, enough protein today?"
→ SCAN: Found "protein shake" = FOOD DATA + question
→ DECISION: Food found = MUST call tools
→ Call add_food(mealType: "post_workout", name: "Protein Shake", servingSize: 1, servingUnit: "serving", calories: 150, protein: 25, carbs: 5, fat: 2)
→ THEN answer about their protein progress

User: "just had a banana, feeling hungry though"
→ SCAN: Found "banana" = FOOD DATA + statement about hunger
→ DECISION: Food found = MUST call tools
→ Call add_food, THEN address the hunger (suggest protein to feel fuller)

### Repeat/Context Shortcuts

User: "another one" (after logging a protein shake)
→ SCAN: "another one" = REPEAT INDICATOR (type B)
→ Call add_food with LAST LOGGED FOOD values: same food, same macros

User: "same as before"
→ SCAN: "same as before" = REPEAT INDICATOR (type B)
→ Call add_food with LAST LOGGED FOOD values

### Standard Food Logging

User: "had eggs and toast for breakfast"
→ Call add_food for eggs (mealType: "breakfast", 2 eggs = 156cal, 12g P)
→ Call add_food for toast (mealType: "breakfast", 2 slices = 160cal, 6g P)
→ BOTH tools in ONE response

User: "chicken salad"
→ Estimate: ~350cal, 30g P, 15g C, 18g F
→ Call add_food with these estimates

User: "had a sandwich, maybe 400 cal?"
→ Use user's estimate: calories: 400, estimate protein ~15g based on typical sandwich
→ Call add_food with their estimate

### Corrections

User: "actually that was 500 cal not 400"
→ Call update_food to correct the value

User: "I had 3 eggs not 2"
→ Call update_food to adjust (3 eggs = 234cal, 18g P)

### Pure Questions (NO tools)

User: "what should I eat for dinner?"
→ SCAN: No food mentioned, just question = PURE QUESTION (type F)
→ NO TOOL CALLS - answer based on their remaining targets

User: "am I getting enough protein?"
→ SCAN: No food = PURE QUESTION
→ NO TOOL CALLS - check their progress and advise

## IMPORTANT RULES
- ALWAYS estimate macros - never ask user for exact values
- Use your MACRO KNOWLEDGE to provide realistic estimates
- If user provides an estimate, use it but fill in missing macros reasonably
- Keep coaching comments to 1-2 SHORT sentences, plain text only
- No markdown, no formatting, no bullet points - just plain conversational text

## FINAL RULES

- Keep response to 1 short sentence unless user asked a question or you have a genuinely useful insight from history
- No markdown, no formatting, no bullet points - just plain conversational text
- NEVER recite numbers the log card already shows
- If user provides food data or asks about food they ate, you MUST call add_food. Never just comment.
`;
}

/**
 * Format diet log for prompt context
 */
function formatDietLogForPrompt(dietLog: DietLog): string {
  const lines: string[] = [];

  lines.push(`Date: ${dietLog.date}`);
  lines.push('');

  for (const meal of dietLog.meals) {
    const mealLabel = meal.mealType.replace('_', ' ').toUpperCase();
    lines.push(`### ${mealLabel} (ID: ${meal.id})`);
    if (meal.time) lines.push(`Time: ${meal.time}`);

    if (meal.foods.length > 0) {
      for (const food of meal.foods) {
        lines.push(`  - ${food.name} (ID: ${food.id})`);
        lines.push(`    ${food.servingSize} ${food.servingUnit} | ${food.macros.calories} cal, ${food.macros.protein}g P, ${food.macros.carbs}g C, ${food.macros.fat}g F`);
      }
      lines.push(`  Meal Total: ${meal.totalMacros.calories} cal, ${meal.totalMacros.protein}g protein`);
    } else {
      lines.push('  (no foods logged yet)');
    }
    lines.push('');
  }

  lines.push('### DAY TOTALS');
  lines.push(`Calories: ${dietLog.summary.progress.consumed.calories}/${dietLog.targets.calories}`);
  lines.push(`Protein: ${dietLog.summary.progress.consumed.protein}g/${dietLog.targets.protein}g`);
  lines.push(`Carbs: ${dietLog.summary.progress.consumed.carbs}g/${dietLog.targets.carbs}g`);
  lines.push(`Fat: ${dietLog.summary.progress.consumed.fat}g/${dietLog.targets.fat}g`);

  if (dietLog.waterIntake) {
    lines.push(`Water: ${dietLog.waterIntake}ml`);
  }

  return lines.join('\n');
}

/**
 * Execute the diet coach agent
 */
export async function executeDietCoachAgent(
  currentDietLog: DietLog | undefined,
  userMessage: string,
  brainTransfer: string,
  previousMessages: ChatMessage[] = [],
  analysis?: SessionAnalysis,
  cyclePhase?: MenstrualCycleInfo,
  lastLoggedFood?: LastLoggedFood,
  dietHistoryContext?: string,
  dayPlanContext?: string
): Promise<DietCoachAgentResult> {
  if (!OPENAI_API_KEY) {
    return {
      updatedDietLog: currentDietLog || createEmptyDietLog(),
      coachComment: 'Configuration error - please check API settings.',
      toolsUsed: [],
      error: 'No OpenAI API key configured'
    };
  }

  // Create empty diet log if none exists
  const dietLog = currentDietLog || createEmptyDietLog();

  const systemPrompt = buildSystemPrompt(brainTransfer, dietLog, analysis, cyclePhase, lastLoggedFood, dietHistoryContext, dayPlanContext);

  // Build message history
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...previousMessages,
    { role: 'user', content: userMessage }
  ];

  try {
    // Initial API call with tools
    const response = await callOpenAI(messages, true);

    if (!response.choices?.[0]?.message) {
      return {
        updatedDietLog: dietLog,
        coachComment: 'Failed to get response from AI.',
        toolsUsed: [],
        error: 'Empty response'
      };
    }

    const assistantMessage = response.choices[0].message;
    let workingDietLog = dietLog;
    const toolsUsed: string[] = [];
    let newLastLoggedFood: LastLoggedFood | undefined = lastLoggedFood;

    // Process tool calls if any
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: ChatMessage[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await processToolCall(workingDietLog, toolName, args);

          workingDietLog = result.dietLog;

          // Capture last logged food for "another one" context
          if (toolName === 'add_food') {
            const foodArgs = args as AddFoodArgs;
            const meal = workingDietLog.meals.find(m =>
              m.id === foodArgs.mealId ||
              m.mealType === foodArgs.mealType
            );
            const food = meal?.foods[meal.foods.length - 1];

            if (meal && food) {
              newLastLoggedFood = {
                mealId: meal.id,
                mealType: meal.mealType,
                foodId: food.id,
                foodName: food.name,
                calories: food.macros.calories,
                protein: food.macros.protein
              };
            }
          }

          toolResults.push({
            role: 'tool',
            content: JSON.stringify({
              success: true,
              ...result.data
            }),
            tool_call_id: toolCall.id
          });
        } catch (toolError) {
          console.error(`[DietCoachAgent] Tool ${toolName} error:`, toolError);
          toolResults.push({
            role: 'tool',
            content: JSON.stringify({
              success: false,
              error: toolError instanceof Error ? toolError.message : 'Unknown error'
            }),
            tool_call_id: toolCall.id
          });
        }
      }

      // Verification pass: inject updated state WITH tools still enabled
      const updatedDietContext = formatDietLogForPrompt(workingDietLog);
      const verificationMessages: ChatMessage[] = [
        ...messages,
        {
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls
        },
        ...toolResults,
        {
          role: 'system',
          content: `UPDATED DIET LOG STATE after your tool calls:
${updatedDietContext}

VERIFY: Does every piece of food data from the user's message appear correctly in the log above? If something is missing or wrong, call the appropriate tool to fix it. If everything is correct, respond with your coaching comment (1 short sentence, no macro recitation).`
        }
      ];

      const verificationResponse = await callOpenAI(verificationMessages, true);
      const verificationMessage = verificationResponse.choices?.[0]?.message;

      // If verification found issues and made more tool calls, process them
      if (verificationMessage?.tool_calls && verificationMessage.tool_calls.length > 0) {
        const verificationToolResults: ChatMessage[] = [];

        for (const toolCall of verificationMessage.tool_calls) {
          const toolName = toolCall.function.name;
          toolsUsed.push(toolName);

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await processToolCall(workingDietLog, toolName, args);
            workingDietLog = result.dietLog;

            // Update lastLoggedFood if add_food
            if (toolName === 'add_food') {
              const foodArgs = args as AddFoodArgs;
              const meal = workingDietLog.meals.find(m =>
                m.id === foodArgs.mealId ||
                m.mealType === foodArgs.mealType
              );
              const food = meal?.foods[meal.foods.length - 1];
              if (meal && food) {
                newLastLoggedFood = {
                  mealId: meal.id,
                  mealType: meal.mealType,
                  foodId: food.id,
                  foodName: food.name,
                  calories: food.macros.calories,
                  protein: food.macros.protein
                };
              }
            }

            verificationToolResults.push({
              role: 'tool',
              content: JSON.stringify({ success: true, ...result.data }),
              tool_call_id: toolCall.id
            });
          } catch (toolError) {
            console.error(`[DietCoachAgent] Verification tool ${toolName} error:`, toolError);
            verificationToolResults.push({
              role: 'tool',
              content: JSON.stringify({
                success: false,
                error: toolError instanceof Error ? toolError.message : 'Unknown error'
              }),
              tool_call_id: toolCall.id
            });
          }
        }

        // Final call without tools for coaching comment
        const finalMessages: ChatMessage[] = [
          ...verificationMessages,
          {
            role: 'assistant',
            content: verificationMessage.content || '',
            tool_calls: verificationMessage.tool_calls
          },
          ...verificationToolResults
        ];

        const finalResponse = await callOpenAI(finalMessages, false);
        const coachComment = finalResponse.choices?.[0]?.message?.content || 'Done!';

        return {
          updatedDietLog: workingDietLog,
          coachComment,
          toolsUsed,
          lastLoggedFood: newLastLoggedFood
        };
      }

      // No verification tool calls — use the verification response as the coaching comment
      const coachComment = verificationMessage?.content || 'Done!';

      return {
        updatedDietLog: workingDietLog,
        coachComment,
        toolsUsed,
        lastLoggedFood: newLastLoggedFood
      };
    }

    // No tool calls - just return the comment
    return {
      updatedDietLog: workingDietLog,
      coachComment: assistantMessage.content || '',
      toolsUsed: []
    };
  } catch (error) {
    console.error('[DietCoachAgent] Error:', error);
    return {
      updatedDietLog: dietLog,
      coachComment: 'Something went wrong. Please try again.',
      toolsUsed: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  messages: ChatMessage[],
  includeTools: boolean
): Promise<OpenAIResponse> {
  const requestBody: Record<string, unknown> = {
    model: 'gpt-4.1',
    messages,
    temperature: 0.1, // Low for strict instruction following (matches gym agent)
    max_tokens: includeTools ? 1024 : 200 // 1024 for tool reasoning, 200 for short coaching comments
  };

  if (includeTools) {
    requestBody.tools = DIET_COACH_TOOLS;
    requestBody.tool_choice = 'auto';
    requestBody.parallel_tool_calls = true;
  }

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
    console.error('[DietCoachAgent] OpenAI error:', error);
    throw new Error('OpenAI API error');
  }

  return response.json();
}

/**
 * Process a tool call and return updated diet log
 */
async function processToolCall(
  dietLog: DietLog,
  toolName: string,
  args: unknown
): Promise<{ dietLog: DietLog; data?: Record<string, unknown> }> {
  switch (toolName) {
    case 'add_meal': {
      const result = handleAddMeal(dietLog, args as AddMealArgs);
      return {
        dietLog: result.dietLog,
        data: {
          mealId: result.mealId,
          mealType: (args as AddMealArgs).mealType,
          alreadyExists: result.alreadyExists,
          message: result.alreadyExists
            ? `Meal "${(args as AddMealArgs).mealType}" already exists, using existing ID`
            : `Created new meal "${(args as AddMealArgs).mealType}"`
        }
      };
    }

    case 'add_food': {
      const result = handleAddFood(dietLog, args as AddFoodArgs);
      return {
        dietLog: result.dietLog,
        data: {
          foodId: result.foodId,
          mealId: result.mealId,
          foodName: (args as AddFoodArgs).name,
          macros: {
            calories: (args as AddFoodArgs).calories,
            protein: (args as AddFoodArgs).protein,
            carbs: (args as AddFoodArgs).carbs,
            fat: (args as AddFoodArgs).fat
          },
          wasDuplicate: result.wasDuplicate
        }
      };
    }

    case 'update_food': {
      const result = handleUpdateFood(dietLog, args as UpdateFoodArgs);
      return {
        dietLog: result.dietLog,
        data: { updated: result.updated }
      };
    }

    case 'remove_food': {
      const result = handleRemoveFood(dietLog, args as RemoveFoodArgs);
      return {
        dietLog: result.dietLog,
        data: { removed: result.removed, foodName: result.foodName }
      };
    }

    case 'remove_meal': {
      const result = handleRemoveMeal(dietLog, args as RemoveMealArgs);
      return {
        dietLog: result.dietLog,
        data: {
          removed: result.removed,
          mealType: result.mealType,
          foodCount: result.foodCount
        }
      };
    }

    case 'update_meal': {
      const result = handleUpdateMeal(dietLog, args as UpdateMealArgs);
      return {
        dietLog: result.dietLog,
        data: { updated: result.updated }
      };
    }

    case 'get_food_history': {
      // TODO: Implement food history query from database
      const historyArgs = args as GetFoodHistoryArgs;
      console.log('[DietCoachAgent] Food history query:', historyArgs);
      return {
        dietLog,
        data: { history: [], message: 'Food history not yet implemented' }
      };
    }

    case 'update_daily_notes': {
      const result = handleUpdateDaily(dietLog, args as UpdateDailyNotesArgs);
      return {
        dietLog: result.dietLog,
        data: { updated: result.updated }
      };
    }

    default:
      console.warn(`[DietCoachAgent] Unknown tool: ${toolName}`);
      return { dietLog };
  }
}
