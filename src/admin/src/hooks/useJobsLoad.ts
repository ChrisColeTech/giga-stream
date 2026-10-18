import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { useJobActions } from "./useJobActions";

/** Loads the jobs (and the playlists for the select and the gate) when the tab is first shown in a session and again
 *  when another tab's write marked them stale; never otherwise, and never on a timer: a catalog run's end is read by a
 *  Refresh. A new session first resets the slice and the statusbar's `N syncing`, so nothing of the last account is
 *  shown. */
export function useJobsLoad(active: boolean): void {
  const { flows } = useJobActions();
  const serial = useAppStore((state) => state.serial);
  const held = useAppStore((state) => state.jobs.session);
  const status = useAppStore((state) => state.jobs.status);
  const stale = useAppStore((state) => state.stale.jobs);
  const reset = useAppStore((state) => state.jobsReset);
  const setWork = useAppStore((state) => state.setWork);
  const clearStale = useAppStore((state) => state.clearStale);

  useEffect(() => {
    if (held === serial) return;
    reset(serial);
    setWork({ syncing: 0 });
  }, [held, serial, reset, setWork]);

  useEffect(() => {
    if (!active || held !== serial || (status !== "idle" && !stale)) return;
    clearStale("jobs");
    void flows.load();
  }, [active, held, serial, status, stale, flows, clearStale]);
}
