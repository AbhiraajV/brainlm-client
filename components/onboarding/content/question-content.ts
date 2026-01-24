import type { QuestionStepConfig, CompletionStepConfig } from '@/lib/onboarding/types';

export const questionSteps: QuestionStepConfig[] = [
  {
    type: 'question',
    id: 'life-context',
    title: 'Life Context',
    description: 'Help us understand your current situation and daily rhythm.',
    questions: [
      {
        id: 'question-1',
        text: 'How would you describe your current phase of life?',
      },
      {
        id: 'question-2',
        text: 'What does a typical weekday look like for you?',
      },
      {
        id: 'question-3',
        text: 'What currently takes most of your time and mental energy?',
      },
    ],
    reassurance: 'You can edit this anytime. The system will adapt.',
  },
  {
    type: 'question',
    id: 'routines',
    title: 'Routines & Structure',
    description: 'Understanding your habits helps the system recognize what\'s normal for you.',
    questions: [
      {
        id: 'question-1',
        text: 'What routines do you currently follow (work, fitness, food, sleep)?',
      },
      {
        id: 'question-2',
        text: 'Which routines feel stable?',
      },
      {
        id: 'question-3',
        text: 'Which feel inconsistent or fragile?',
      },
    ],
    reassurance: 'You can edit this anytime. The system will adapt.',
  },
  {
    type: 'question',
    id: 'strengths',
    title: 'Strengths & Pride',
    description: 'Knowing what\'s working helps the system reinforce it.',
    questions: [
      {
        id: 'question-1',
        text: 'What\'s something you\'re doing well right now?',
      },
      {
        id: 'question-2',
        text: 'What are you proud of maintaining?',
      },
    ],
    reassurance: 'You can edit this anytime. The system will adapt.',
  },
  {
    type: 'question',
    id: 'struggles',
    title: 'Struggles & Friction',
    description: 'Understanding friction points helps the system spot patterns you might miss.',
    questions: [
      {
        id: 'question-1',
        text: 'What feels harder than it should?',
      },
      {
        id: 'question-2',
        text: 'Are there habits or patterns you want to reduce or break?',
      },
      {
        id: 'question-3',
        text: 'What tends to derail your days?',
      },
    ],
    reassurance: 'You can edit this anytime. The system will adapt.',
  },
  {
    type: 'question',
    id: 'goals',
    title: 'Goals & Direction',
    description: 'Where you\'re headed shapes what insights matter most.',
    questions: [
      {
        id: 'question-1',
        text: 'What are you trying to move toward in the next few months?',
      },
      {
        id: 'question-2',
        text: 'What does "progress" look like to you (not society)?',
      },
    ],
    reassurance: 'You can edit this anytime. The system will adapt.',
  },
  {
    type: 'question',
    id: 'quantitative',
    title: 'Health, Work, Numbers',
    description: 'Understanding what you track helps the system speak your language.',
    questions: [
      {
        id: 'question-1',
        text: 'Do you track anything? (gym, calories, money, time, sleep)',
      },
      {
        id: 'question-2',
        text: 'What matters more right now: consistency or improvement?',
      },
    ],
    reassurance: 'You can edit this anytime. The system will adapt.',
  },
  {
    type: 'question',
    id: 'reflection',
    title: 'Reflection Style',
    description: 'How you prefer to receive feedback shapes how the system communicates.',
    questions: [
      {
        id: 'question-1',
        text: 'How do you prefer feedback? (direct, neutral, gentle, analytical)',
      },
      {
        id: 'question-2',
        text: 'What frustrates you about self-improvement tools?',
      },
    ],
    reassurance: 'You can edit this anytime. The system will adapt.',
  },
];

export const completionStep: CompletionStepConfig = {
  type: 'completion',
  id: 'completion',
  title: 'Baseline Established',
  content: `You've given the system what it needs to start understanding you.

From here, everything you log becomes part of your personal context. The system will learn your patterns, notice what you don't notice, and surface insights that actually matter to your life.

This baseline isn't permanent. As you change, the system changes with you. But you've given it somewhere to start.

Welcome to Motif.`,
};
