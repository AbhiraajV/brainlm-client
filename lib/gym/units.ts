import type { WeightUnit } from '@/lib/sessions/types';

const KG_TO_LBS = 2.20462;

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  if (from === 'kg' && to === 'lbs') return Math.round(value * KG_TO_LBS * 10) / 10;
  return Math.round(value / KG_TO_LBS * 10) / 10; // lbs → kg
}

export function formatWeightWithUnit(value: number, storedUnit: WeightUnit, displayUnit: WeightUnit): string {
  const converted = convertWeight(value, storedUnit, displayUnit);
  const formatted = Number.isInteger(converted) ? converted.toString() : converted.toFixed(1);
  return formatted;
}

export const DEFAULT_UNIT: WeightUnit = 'lbs';
