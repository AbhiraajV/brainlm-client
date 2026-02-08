/**
 * Centralized muscle group definitions.
 * Single source of truth for parent mapping, display names, and colors.
 */

import type { MuscleGroup } from '@/lib/sessions/types';

// ============================================================================
// PARENT MAPPING: sub-group → broad group
// ============================================================================

export const MUSCLE_GROUP_PARENT: Partial<Record<MuscleGroup, MuscleGroup>> = {
  // Chest
  upper_chest: 'chest', mid_chest: 'chest', lower_chest: 'chest',
  // Back / Traps
  upper_traps: 'traps', mid_traps: 'traps', lower_traps: 'traps',
  rhomboids: 'back', teres_major: 'back', spinal_erectors: 'lower_back',
  // Shoulders
  front_delts: 'shoulders', side_delts: 'shoulders', rear_delts: 'shoulders',
  // Biceps
  biceps_long_head: 'biceps', biceps_short_head: 'biceps', brachialis: 'biceps',
  // Triceps
  triceps_long_head: 'triceps', triceps_lateral_head: 'triceps', triceps_medial_head: 'triceps',
  // Forearms
  forearm_flexors: 'forearms', forearm_extensors: 'forearms', brachioradialis: 'forearms',
  // Glutes
  glute_max: 'glutes', glute_medius: 'glutes', glute_minimus: 'glutes',
  // Quads
  rectus_femoris: 'quadriceps', vastus_lateralis: 'quadriceps',
  vastus_medialis: 'quadriceps', vastus_intermedius: 'quadriceps',
  // Hamstrings
  biceps_femoris: 'hamstrings', semitendinosus: 'hamstrings', semimembranosus: 'hamstrings',
  // Adductors (map to glutes as closest broad group)
  adductors: 'glutes', adductor_longus: 'glutes', adductor_magnus: 'glutes',
  adductor_brevis: 'glutes', gracilis: 'glutes',
  // Calves
  gastrocnemius: 'calves', soleus: 'calves', tibialis_anterior: 'calves',
  // Core
  upper_abs: 'abs', lower_abs: 'abs', transverse_abdominis: 'abs',
};

/** Get the broad (parent) muscle group for any MuscleGroup value. */
export function getBroadGroup(mg: MuscleGroup): MuscleGroup {
  return MUSCLE_GROUP_PARENT[mg] ?? mg;
}

// ============================================================================
// DISPLAY NAMES
// ============================================================================

export const MUSCLE_GROUP_DISPLAY: Record<MuscleGroup, string> = {
  // Broad groups
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quadriceps: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', obliques: 'Obliques',
  lower_back: 'Lower Back', traps: 'Traps', lats: 'Lats', full_body: 'Full Body',
  // Chest
  upper_chest: 'Upper Chest', mid_chest: 'Mid Chest', lower_chest: 'Lower Chest',
  // Back
  upper_traps: 'Upper Traps', mid_traps: 'Mid Traps', lower_traps: 'Lower Traps',
  rhomboids: 'Rhomboids', teres_major: 'Teres Major', spinal_erectors: 'Spinal Erectors',
  // Shoulders
  front_delts: 'Front Delts', side_delts: 'Side Delts', rear_delts: 'Rear Delts',
  // Biceps
  biceps_long_head: 'Biceps Long Head', biceps_short_head: 'Biceps Short Head', brachialis: 'Brachialis',
  // Triceps
  triceps_long_head: 'Triceps Long Head', triceps_lateral_head: 'Triceps Lateral Head', triceps_medial_head: 'Triceps Medial Head',
  // Forearms
  forearm_flexors: 'Forearm Flexors', forearm_extensors: 'Forearm Extensors', brachioradialis: 'Brachioradialis',
  // Glutes
  glute_max: 'Glute Max', glute_medius: 'Glute Medius', glute_minimus: 'Glute Minimus',
  // Quads
  rectus_femoris: 'Rectus Femoris', vastus_lateralis: 'Vastus Lateralis',
  vastus_medialis: 'Vastus Medialis', vastus_intermedius: 'Vastus Intermedius',
  // Hamstrings
  biceps_femoris: 'Biceps Femoris', semitendinosus: 'Semitendinosus', semimembranosus: 'Semimembranosus',
  // Adductors
  adductors: 'Adductors', adductor_longus: 'Adductor Longus', adductor_magnus: 'Adductor Magnus',
  adductor_brevis: 'Adductor Brevis', gracilis: 'Gracilis',
  // Calves
  gastrocnemius: 'Gastrocnemius', soleus: 'Soleus', tibialis_anterior: 'Tibialis Anterior',
  // Core
  upper_abs: 'Upper Abs', lower_abs: 'Lower Abs', transverse_abdominis: 'Transverse Abdominis',
};

/** Format any MuscleGroup for display, with fallback for unknown values. */
export function formatMuscleGroup(mg: MuscleGroup | null | undefined): string {
  if (!mg) return 'Other';
  return MUSCLE_GROUP_DISPLAY[mg] ?? mg.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================================
// COLORS: sub-groups inherit parent color
// ============================================================================

const BROAD_COLORS: Record<string, string> = {
  chest: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  back: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  shoulders: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  biceps: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  triceps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  forearms: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  quadriceps: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  hamstrings: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  glutes: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  calves: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  abs: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  obliques: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  lower_back: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  traps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  lats: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  full_body: 'bg-[var(--color-line)] text-[var(--color-muted)]',
};

const DEFAULT_COLOR = 'bg-[var(--color-line)] text-[var(--color-muted)]';

/** Get Tailwind color classes for a muscle group. Sub-groups inherit parent color. */
export function getMuscleGroupColor(mg: MuscleGroup): string {
  return BROAD_COLORS[mg] ?? BROAD_COLORS[getBroadGroup(mg)] ?? DEFAULT_COLOR;
}

// ============================================================================
// SYNERGIST MUSCLES: broad group → commonly co-trained muscles
// ============================================================================

export const SYNERGIST_MUSCLES: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
  chest: ['triceps', 'shoulders'],
  back: ['biceps', 'forearms'],
  lats: ['biceps', 'forearms'],
  shoulders: ['triceps', 'chest', 'traps'],
  biceps: ['forearms', 'back'],
  triceps: ['chest', 'shoulders'],
  quadriceps: ['glutes', 'hamstrings', 'calves'],
  hamstrings: ['glutes', 'lower_back', 'calves'],
  glutes: ['hamstrings', 'quadriceps', 'lower_back'],
  calves: ['quadriceps', 'hamstrings'],
  abs: ['obliques', 'lower_back'],
  traps: ['shoulders', 'back'],
};

/**
 * Expand a list of muscle groups to include their broad parents and synergists.
 * Used to filter exercise library data for coach context.
 */
export function expandMuscleGroups(groups: MuscleGroup[]): MuscleGroup[] {
  const expanded = new Set<MuscleGroup>(groups);
  for (const g of groups) {
    const broad = getBroadGroup(g);
    expanded.add(broad);
    const synergists = SYNERGIST_MUSCLES[broad];
    if (synergists) synergists.forEach(s => expanded.add(s));
  }
  return Array.from(expanded);
}

// ============================================================================
// ALL MUSCLE GROUPS (for enums, selects, etc.)
// ============================================================================

/** All muscle group values including sub-groups. */
export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  // Broad groups
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
  'lower_back', 'traps', 'lats', 'full_body',
  // Chest
  'upper_chest', 'mid_chest', 'lower_chest',
  // Back
  'upper_traps', 'mid_traps', 'lower_traps',
  'rhomboids', 'teres_major', 'spinal_erectors',
  // Shoulders
  'front_delts', 'side_delts', 'rear_delts',
  // Biceps
  'biceps_long_head', 'biceps_short_head', 'brachialis',
  // Triceps
  'triceps_long_head', 'triceps_lateral_head', 'triceps_medial_head',
  // Forearms
  'forearm_flexors', 'forearm_extensors', 'brachioradialis',
  // Glutes
  'glute_max', 'glute_medius', 'glute_minimus',
  // Quads
  'rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius',
  // Hamstrings
  'biceps_femoris', 'semitendinosus', 'semimembranosus',
  // Adductors
  'adductors', 'adductor_longus', 'adductor_magnus', 'adductor_brevis', 'gracilis',
  // Calves
  'gastrocnemius', 'soleus', 'tibialis_anterior',
  // Core
  'upper_abs', 'lower_abs', 'transverse_abdominis',
];

/** Broad muscle groups only (for UI selectors, filter pills). */
export const BROAD_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
  'lower_back', 'traps', 'lats', 'full_body',
];
