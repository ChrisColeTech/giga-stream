import { useCallback, useEffect, useState } from "react";

export interface ArmedAction {
  readonly armed: boolean;
  readonly arm: () => void;
  readonly disarm: () => void;
}

/** The armed state of an inline two-step (`01` section 9, `04` section 5): `arm` sets it, `disarm` clears it, and it
 *  clears by itself after `timeoutMs` with no second press. Unmounting clears the timer, so an armed control that is
 *  closed with its window leaves nothing running. */
export function useArmedAction(timeoutMs: number): ArmedAction {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [armed, timeoutMs]);

  const arm = useCallback(() => setArmed(true), []);
  const disarm = useCallback(() => setArmed(false), []);
  return { armed, arm, disarm };
}
