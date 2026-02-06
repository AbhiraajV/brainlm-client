/**
 * Handler for update_daily_notes tool
 * Updates daily notes and water intake tracking
 */

import type { DietLog } from '@/lib/sessions/types';
import type { UpdateDailyNotesArgs } from '../diet-coach-tools';

export interface UpdateDailyResult {
  dietLog: DietLog;
  updated: boolean;
}

/**
 * Update daily notes and water intake
 */
export function handleUpdateDaily(
  dietLog: DietLog,
  args: UpdateDailyNotesArgs
): UpdateDailyResult {
  const updatedDietLog: DietLog = {
    ...dietLog,
    notes: args.notes !== undefined ? args.notes : dietLog.notes,
    waterIntake: args.waterIntake !== undefined ? args.waterIntake : dietLog.waterIntake,
    updatedAt: new Date().toISOString()
  };

  return {
    dietLog: updatedDietLog,
    updated: true
  };
}
