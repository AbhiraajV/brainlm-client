/**
 * Gym calculation formulas for estimated 1RM and volume metrics
 */

/**
 * Epley Formula: Best for 1-10 reps
 * 1RM = weight × (1 + reps/30)
 */
export function calculateE1RM_Epley(weight: number, reps: number): number {
  if (reps === 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Brzycki Formula: More conservative, better for higher reps
 * 1RM = weight × (36 / (37 - reps))
 */
export function calculateE1RM_Brzycki(weight: number, reps: number): number {
  if (reps === 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return weight; // Avoid division by zero or negative
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
}

/**
 * Lombardi Formula: Good all-around formula
 * 1RM = weight × reps^0.10
 */
export function calculateE1RM_Lombardi(weight: number, reps: number): number {
  if (reps === 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * Math.pow(reps, 0.1) * 10) / 10;
}

/**
 * Smart E1RM: Uses Epley for ≤10 reps, Brzycki for >10
 * This provides the most accurate estimate across rep ranges
 */
export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 0) return 0;
  if (reps === 1) return weight;
  if (reps <= 10) return calculateE1RM_Epley(weight, reps);
  return calculateE1RM_Brzycki(weight, reps);
}

/**
 * Volume = weight × reps (for a single set)
 */
export function calculateSetVolume(weight: number, reps: number): number {
  return weight * reps;
}

/**
 * Calculate total volume for multiple sets
 */
export function calculateTotalVolume(sets: { weight: number; actualReps: number }[]): number {
  return sets.reduce((total, set) => total + calculateSetVolume(set.weight, set.actualReps), 0);
}

/**
 * Calculate total reps across sets
 */
export function calculateTotalReps(sets: { actualReps: number }[]): number {
  return sets.reduce((total, set) => total + set.actualReps, 0);
}

/**
 * Calculate average RPE from sets that have RPE recorded
 */
export function calculateAverageRPE(sets: { rpe?: number }[]): number | undefined {
  const setsWithRPE = sets.filter(set => set.rpe !== undefined);
  if (setsWithRPE.length === 0) return undefined;
  const sum = setsWithRPE.reduce((total, set) => total + (set.rpe ?? 0), 0);
  return Math.round((sum / setsWithRPE.length) * 10) / 10;
}

/**
 * Find the best E1RM from a set of workout sets
 */
export function findBestE1RM(sets: { weight: number; actualReps: number }[]): number {
  if (sets.length === 0) return 0;
  return Math.max(...sets.map(set => calculateE1RM(set.weight, set.actualReps)));
}

/**
 * Convert weight between kg and lbs
 */
export function convertWeight(weight: number, from: 'kg' | 'lbs', to: 'kg' | 'lbs'): number {
  if (from === to) return weight;
  if (from === 'kg' && to === 'lbs') {
    return Math.round(weight * 2.20462 * 10) / 10;
  }
  // lbs to kg
  return Math.round(weight / 2.20462 * 10) / 10;
}

/**
 * Calculate intensity percentage based on E1RM
 */
export function calculateIntensity(weight: number, e1rm: number): number {
  if (e1rm === 0) return 0;
  return Math.round((weight / e1rm) * 100);
}

/**
 * Estimate reps at a given weight based on E1RM
 * Using inverse Epley formula: reps = 30 × (e1rm/weight - 1)
 */
export function estimateReps(weight: number, e1rm: number): number {
  if (weight >= e1rm) return 1;
  const reps = 30 * ((e1rm / weight) - 1);
  return Math.max(1, Math.round(reps));
}
