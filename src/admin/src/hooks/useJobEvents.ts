import { useEffect } from "react";
import { streamKeyOf } from "@/lib/job-events-plan";
import { stream } from "@/services/api";
import { runJobEvents } from "@/services/job-events";
import { useAppStore } from "@/store/app-store";

/** Keeps the one job-event stream open for a signed-in session (`44` section 4): opened after sign-in, aborted on
 *  sign-out, reopened when the access token changes, on window focus and when a list's Refresh bumps `jobEventsTick` -
 *  and never on an interval or a retry loop. The decisions are `lib/job-events-plan.ts`; the reading and the writes into
 *  the store are `services/job-events.ts`. Signed out, no job is known to run. */
export function useJobEvents(): void {
  const signedIn = useAppStore((state) => state.signedIn);
  const token = useAppStore((state) => state.tokens?.accessToken ?? null);
  const tick = useAppStore((state) => state.jobEventsTick);
  const key = streamKeyOf(signedIn, token, tick);

  useEffect(() => {
    const store = () => useAppStore.getState();
    if (key === null) {
      store().jobProgressClear();
      store().jobsApplyProgress([]);
      return;
    }
    const controller = new AbortController();
    void runJobEvents({ stream, store }, controller.signal);
    return () => controller.abort();
  }, [key]);

  useEffect(() => {
    const reopen = (): void => useAppStore.getState().jobEventsReopen();
    window.addEventListener("focus", reopen);
    return () => window.removeEventListener("focus", reopen);
  }, []);
}
