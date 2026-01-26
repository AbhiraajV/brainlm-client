'use client';

import { useEffect, useRef } from 'react';
import { syncUserTimezone } from '@/server/actions/user.actions';

/**
 * Background component that syncs the user's browser timezone to the database.
 * Only updates if the stored timezone is still "UTC" (the default).
 * Runs once on mount.
 */
export function TimezoneSync() {
  const hasSynced = useRef(false);

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!browserTimezone || browserTimezone === 'UTC') {
      // Browser couldn't detect timezone or it's actually UTC
      return;
    }

    syncUserTimezone(browserTimezone)
      .then((result) => {
        if (result.updated) {
          console.log(`[TimezoneSync] Timezone updated to ${result.timezone}`);
        }
      })
      .catch((err) => {
        console.error('[TimezoneSync] Failed to sync timezone:', err);
      });
  }, []);

  // This component renders nothing
  return null;
}
