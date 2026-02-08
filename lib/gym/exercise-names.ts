/**
 * Exercise Name Normalization
 *
 * Expands common abbreviations and normalizes names so that
 * "DB Bench Press", "Dumbbell Bench Press", and "bench press dumbbell"
 * all resolve to the same canonical key.
 */

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bbb\b/gi, 'barbell'],
  [/\bdb\b/gi, 'dumbbell'],
  [/\boh\b/gi, 'overhead'],
  [/\bohp\b/gi, 'overhead press'],
  [/\bkb\b/gi, 'kettlebell'],
  [/\bbw\b/gi, 'bodyweight'],
  [/\brdl\b/gi, 'romanian deadlift'],
  [/\bez\b/gi, 'e-z curl'],
  [/\bsldl\b/gi, 'stiff-legged deadlift'],
];

export function normalizeExerciseName(name: string): string {
  let n = name.trim().toLowerCase();

  // Expand abbreviations
  for (const [pattern, replacement] of ABBREVIATIONS) {
    n = n.replace(pattern, replacement);
  }

  // Normalize separators
  n = n.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

  // Sort tokens for word-order independence
  // "Incline Dumbbell Press" and "Dumbbell Incline Press" → same key
  n = n.split(' ').sort().join(' ');

  return n;
}
