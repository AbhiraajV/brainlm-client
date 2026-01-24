"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import type { AllAnswers } from "@/lib/onboarding/types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Question mapping for context building
const QUESTION_SECTIONS = [
  {
    id: 'life-context',
    title: 'Life Context',
    questions: [
      { id: 'question-1', text: 'How would you describe your current phase of life?' },
      { id: 'question-2', text: 'What does a typical weekday look like for you?' },
      { id: 'question-3', text: 'What currently takes most of your time and mental energy?' },
    ],
  },
  {
    id: 'routines',
    title: 'Routines & Structure',
    questions: [
      { id: 'question-1', text: 'What routines do you currently follow (work, fitness, food, sleep)?' },
      { id: 'question-2', text: 'Which routines feel stable?' },
      { id: 'question-3', text: 'Which feel inconsistent or fragile?' },
    ],
  },
  {
    id: 'strengths',
    title: 'Strengths & Pride',
    questions: [
      { id: 'question-1', text: "What's something you're doing well right now?" },
      { id: 'question-2', text: 'What are you proud of maintaining?' },
    ],
  },
  {
    id: 'struggles',
    title: 'Struggles & Friction',
    questions: [
      { id: 'question-1', text: 'What feels harder than it should?' },
      { id: 'question-2', text: 'Are there habits or patterns you want to reduce or break?' },
      { id: 'question-3', text: 'What tends to derail your days?' },
    ],
  },
  {
    id: 'goals',
    title: 'Goals & Direction',
    questions: [
      { id: 'question-1', text: 'What are you trying to move toward in the next few months?' },
      { id: 'question-2', text: 'What does "progress" look like to you (not society)?' },
    ],
  },
  {
    id: 'quantitative',
    title: 'Health, Work, Numbers',
    questions: [
      { id: 'question-1', text: 'Do you track anything? (gym, calories, money, time, sleep)' },
      { id: 'question-2', text: 'What matters more right now: consistency or improvement?' },
    ],
  },
  {
    id: 'reflection',
    title: 'Reflection Style',
    questions: [
      { id: 'question-1', text: 'How do you prefer feedback? (direct, neutral, gentle, analytical)' },
      { id: 'question-2', text: 'What frustrates you about self-improvement tools?' },
    ],
  },
];

const CONSOLIDATION_SYSTEM_PROMPT = `You are a **formatter and consolidator**, not an advisor, therapist, or analyst.

Your task is to convert raw onboarding answers into a **single, durable, detail-preserving Markdown (.md) document** that represents the user's **current baseline**.
### MAIN RULE: DO NOT MISS OR REMOVE OR LOSE ANY CONTEXT USER HAS PROVIDED.

### VOICE CONSTRAINT (CRITICAL)

Write in **first person**, as if this document is the user speaking about themselves.

✅ Use: "I", "my", "currently", "right now"
❌ Avoid: "the user", "they", "this person"

This document should read like:
"A clear self-description written by me, cleaned up for clarity and structure."

### Core Rules (Non-Negotiable)

* **Do NOT add advice, plans, suggestions, or recommendations**
* **Do NOT infer emotions, intentions, or traits not explicitly stated**
* **Do NOT normalize, motivate, encourage, or judge**
* **Do NOT reduce specificity or remove nuance**
* **Do NOT hallucinate missing information**
* If something is unclear, preserve it as-is and label it clearly

You may:

* Reword for clarity and precision **without changing meaning**
* Reorganize content for readability
* Group related ideas under consistent headings
* Preserve contradictions if present
* Maintain the user's voice and intent
* Rewording must preserve the user's original tone (casual, fragmented, emotional if present); do not formalize language unnecessarily

---

### Input You Will Receive

* Raw onboarding responses written by the user
* Responses may be incomplete, repetitive, emotional, messy, or unstructured
* Some sections may be empty or sparse
* Each response maps directly to one or more sections below
* Do NOT invent new domains or fill in missing sections
* If a section has little or no input, leave it sparse or empty

---

### Output Requirements

Produce **one Markdown document** with the following characteristics:

* Clear, consistent section headings
* Explicit separation between **facts**, **self-described patterns**, **goals**, **struggles**, and **open uncertainties**
* High readability for both humans and future LLMs
* Designed to be used as **context input** for all downstream reasoning systems

---

### Required Structure (Use All Headings)

# User Baseline (Current State)

## Identity & Context
(Who the user is, how they describe themselves, life context, constraints)

## Daily Life & Routines
(Current routines, variability, energy patterns, structure or lack thereof)

## Goals & Aspirations
(Short-term and long-term goals as stated, without interpretation)

## Struggles & Frictions
(Explicit difficulties, blockers, recurring issues)

## Habits
### Habits to Build
### Habits to Reduce or Break

## Work, Study & Productivity
(Work context, pressures, ambitions, dissatisfaction if any)

## Health & Physical State
(Fitness, diet, sleep, physical routines — factual only)

## Mental & Emotional State (Self-Reported)
(Only what the user explicitly says — no interpretation)

## Relationships & Social Context
(Family, romantic, social dynamics as described)

## Values, Pride & Identity Anchors
(What the user cares about, is proud of, or identifies with)

## Fears, Anxieties & Uncertainties
(Self-reported only)

## Change Sensitivity
(What the user says is changing, unstable, or in flux)

## Open Questions & Unknowns
(Things the user is unsure about or explicitly questions)

## Notes in User's Own Words
(Short preserved excerpts that feel important or emotionally loaded)

---

### Formatting Guidelines

* Use **bullet points** where clarity improves
* Preserve **temporal language** (e.g., "recently", "currently", "lately")
* Preserve uncertainty using phrases like:
  * "I'm unsure whether…"
  * "I feel ambiguity around…"
* Do **not** resolve contradictions — surface them

---

### Final Constraint

This document must feel like:

> "A clear snapshot of who I am **right now**, before any analysis, planning, or optimization begins."

Nothing more. Nothing less.`;

/**
 * Build formatted context from answers with question text
 */
function buildAnswersContext(answers: AllAnswers): string {
  const sections: string[] = [];

  for (const section of QUESTION_SECTIONS) {
    const sectionAnswers = answers[section.id];
    if (!sectionAnswers) continue;

    const questionAnswers: string[] = [];
    for (const question of section.questions) {
      const answer = sectionAnswers[question.id];
      if (answer && answer.trim()) {
        questionAnswers.push(`Q: ${question.text}\nA: ${answer}`);
      }
    }

    if (questionAnswers.length > 0) {
      sections.push(`## ${section.title}\n\n${questionAnswers.join('\n\n')}`);
    }
  }

  return sections.length > 0
    ? `# User Onboarding Responses\n\n${sections.join('\n\n---\n\n')}`
    : 'No answers provided.';
}

/**
 * Consolidate raw onboarding answers into a formatted markdown baseline using AI
 */
export async function consolidateBaseline(
  answers: AllAnswers
): Promise<{ markdown: string } | { error: string }> {
  if (!OPENAI_API_KEY) {
    return { error: 'OpenAI API key not configured' };
  }

  const formattedAnswers = buildAnswersContext(answers);

  // Check if there are any meaningful answers
  if (formattedAnswers === 'No answers provided.') {
    return { error: 'No answers provided to consolidate' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CONSOLIDATION_SYSTEM_PROMPT },
          { role: 'user', content: formattedAnswers },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI consolidation error:', errorData);
      return { error: 'Failed to consolidate baseline' };
    }

    const data = await response.json();
    const markdown = data.choices?.[0]?.message?.content;

    if (!markdown) {
      return { error: 'No response from AI' };
    }

    return { markdown };
  } catch (error) {
    console.error('Baseline consolidation error:', error);
    return { error: 'Failed to consolidate baseline' };
  }
}

/**
 * Check if the current user has completed onboarding
 */
export async function checkOnboardingStatus(): Promise<{ completed: boolean }> {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { baseline: true },
  });

  return { completed: !!dbUser?.baseline };
}

/**
 * Save the baseline data from onboarding to the user's profile
 * Consolidates answers via AI and stores the formatted markdown
 */
export async function saveBaseline(answers: AllAnswers): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  // Consolidate via AI
  const result = await consolidateBaseline(answers);
  if ('error' in result) {
    return { success: false, error: result.error };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        baseline: result.markdown,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to save baseline:', error);
    return { success: false, error: 'Failed to save baseline data' };
  }
}

/**
 * Get the current user's baseline markdown (if exists)
 */
export async function getBaseline(): Promise<string | null> {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { baseline: true },
  });

  return dbUser?.baseline || null;
}
