const THINKING_MESSAGES = {
  signal: [
    'Extracting salient signals',
    'Normalizing event context'
  ],
  structural: [
    'Checking cross-event consistency',
    'Evaluating recurrence probability'
  ],
  quantitative: [
    'Assessing deviation from baseline',
    'Evaluating magnitude vs noise'
  ],
  pattern: [
    'Comparing against prior sequences',
    'Determining pattern sufficiency'
  ]
}

const allMessages = Object.values(THINKING_MESSAGES).flat()

export function getRandomThinkingMessage(): string {
  return allMessages[Math.floor(Math.random() * allMessages.length)]
}

// Returns 3 unique messages for the 3 sections
export function getUniqueThinkingMessages(): [string, string, string] {
  const shuffled = [...allMessages].sort(() => Math.random() - 0.5)
  return [shuffled[0], shuffled[1], shuffled[2]]
}
