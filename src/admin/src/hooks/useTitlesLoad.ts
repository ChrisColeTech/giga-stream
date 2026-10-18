import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { useTitleFlows } from "./useTitleFlows";

/** Reads the titles when the tab is first shown in a session, and again when another tab's write marked them stale; never
 *  otherwise (no polling). It reads the list the tab SHOWS: the stored titles (the default) or, once `Browse TMDB` is
 *  chosen, the TMDB page; each is read the first time its view is shown and then kept, so switching views keeps each
 *  view's state. A new sign-in resets the slice first (the view back to `Stored`, page 1, both kinds, Newest), so
 *  nothing of one session is shown in the next. A failed read stays failed: Refresh is the way back. */
export function useTitlesLoad(active: boolean): void {
  const flows = useTitleFlows();
  const serial = useAppStore((state) => state.serial);
  const signedIn = useAppStore((state) => state.signedIn);
  const owner = useAppStore((state) => state.titles.session);
  const browse = useAppStore((state) => state.titles.status);
  const mode = useAppStore((state) => state.titlesStored.mode);
  const stored = useAppStore((state) => state.titlesStored.status);
  const stale = useAppStore((state) => state.stale.titles);
  const reset = useAppStore((state) => state.titlesReset);
  const clearStale = useAppStore((state) => state.clearStale);

  useEffect(() => {
    if (signedIn && owner !== serial) reset(serial);
  }, [signedIn, owner, serial, reset]);

  useEffect(() => {
    if (!active || !signedIn || owner !== serial) return;
    const status = mode === "stored" ? stored : browse;
    if (status !== "idle" && !stale) return;
    clearStale("titles");
    void (mode === "stored" ? flows.loadStored() : flows.load());
    void flows.loadDeleted();
  }, [active, signedIn, owner, serial, mode, stored, browse, stale, flows, clearStale]);
}
