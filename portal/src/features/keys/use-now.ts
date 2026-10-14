import { useEffect, useState } from "react";

/**
 * The current time as state, refreshed on an interval. Rendering reads this
 * instead of calling Date.now(), so output stays pure and "3 minutes ago"
 * keeps up while the page is open.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
