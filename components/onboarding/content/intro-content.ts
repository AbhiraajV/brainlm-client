import type { IntroStepConfig } from '@/lib/onboarding/types';

export const introSteps: IntroStepConfig[] = [
  {
    type: 'intro',
    id: 'intro-1',
    title: 'We only work if we know you',
    content: `We're not a generic tracker.
We're a **personal reasoning system**.

We don't tell you what *should* matter.
We learn what **actually does** — from your life, your context, your patterns.

To do that, we need to understand *who you are today*.`,
    nextLabel: 'I understand',
  },
  {
    type: 'intro',
    id: 'intro-2',
    title: 'Required doesn\'t mean rushed',
    content: `**7 areas** of your life. Required because we **refuse to guess**.

- Pause *anytime*
- Come back later
- Resume *exactly* where you stopped

Progress saves automatically.
**Thoughtful answers compound.**`,
    nextLabel: 'I\'ll take my time',
  },
  {
    type: 'intro',
    id: 'intro-3',
    title: 'Think of this as a conversation',
    content: `Not a test. Not a quiz. Not an evaluation.

A conversation with a team built to:
- **Listen** first
- **Observe** carefully
- **Reason**, not judge

No right answers. Only *honest* ones.`,
    nextLabel: 'Let\'s talk',
  },
  {
    type: 'intro',
    id: 'intro-4',
    title: 'Why you can\'t skip questions',
    content: `Every question fills a gap we'd otherwise *assume*.

We're not MCQ because:
- We avoid advice that **doesn't fit**
- We understand what matters *to you*
- We detect **personal** patterns, not statistical
- We surface insights that *actually* resonate

**We don't do guesses.**`,
    nextLabel: 'No skipping',
  },
  {
    type: 'intro',
    id: 'intro-5',
    title: 'How long this takes',
    content: `**10–20 minutes.** Some take longer — they find it *clarifying*.

No timer. No pressure. We'll wait.

---

This baseline isn't permanent.
We refine it. We update it. We evolve together.

**When you're ready, begin.**`,
    nextLabel: 'Begin',
  },
];
