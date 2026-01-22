import { useState, useEffect } from 'react';

/**
 * Hook to detect when the client has hydrated.
 * Use this to prevent SSR mismatch when using Zustand store values
 * that are only available on the client (e.g., from localStorage).
 *
 * @returns boolean - true when client has mounted/hydrated
 *
 * @example
 * const hydrated = useHydrated();
 * const count = useSessionsStore(selectTodaysSessions).length;
 *
 * // Show count only after hydration to prevent mismatch
 * {hydrated && count > 0 && <Badge>{count}</Badge>}
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
