import { useEffect, useRef } from 'react';
import { logError } from '../lib/logger';

export function usePolling(
  fn: () => Promise<boolean>, // return true to stop polling
  intervalMs: number,
  enabled: boolean,
  maxAttempts = 100,
): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const fnRef = useRef(fn);

  // Keep fn ref up to date without restarting the interval
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    attemptsRef.current = 0;

    const tick = async () => {
      attemptsRef.current += 1;

      try {
        const shouldStop = await fnRef.current();
        if (shouldStop || attemptsRef.current >= maxAttempts) {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        logError('Polling error:', err);
        // Stop polling on error
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    intervalRef.current = setInterval(tick, intervalMs);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs, maxAttempts]);
}
