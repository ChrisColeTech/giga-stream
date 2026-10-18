import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { useTitleFlows } from "./useTitleFlows";

/** Reads the titles when the tab is first shown in a session (status `idle`) and again when another tab's write marked
 *  them stale; never otherwise (no polling). A new sign-in resets the slice first (the view back to page 1, both kinds,
 *  Newest), so nothing of one session is shown in the next. A failed read stays failed: Refresh is the way back. */
export function useTitlesLoad(active: boolean): void {
  const flows = useTitleFlows();
  const serial = useAppStore((state) => state.serial);
  const signedIn = useAppStore((state) => state.signedIn);
  const owner = useAppStore((state) => state.titles.session);
  const status = useAppStore((state) => state.titles.status);
  const stale = useAppStore((state) => state.stale.titles);
  const reset = useAppStore((state) => state.titlesReset);
  const clearStale = useAppStore((state) => state.clearStale);

  useEffect(() => {
    if (signedIn && owner !== serial) reset(serial);
  }, [signedIn, owner, serial, reset]);

  useEffect(() => {
    if (!active || !signedIn || owner !== serial || (status !== "idle" && !stale)) return;
    clearStale("titles");
    void flows.load();
    void flows.loadDeleted();
  },[active, signedIn, owner, serial, status, stale, flows, clearStale]);
}
