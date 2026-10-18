import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { useProviderFlows } from "./useProviderFlows";

/** Loads the providers when the tab is first shown in a session (status `idle`) and again when another tab's write
 *  marked them stale; never otherwise (no polling, `01` section 4.4). A new sign-in resets the slice first, so nothing
 *  of one session is shown in the next. A failed read leaves the status `failed`: Refresh is the way back. */
export function useProvidersLoad(active: boolean): void {
  const flows = useProviderFlows();
  const serial = useAppStore((state) => state.serial);
  const signedIn = useAppStore((state) => state.signedIn);
  const owner = useAppStore((state) => state.providers.session);
  const status = useAppStore((state) => state.providers.status);
  const stale = useAppStore((state) => state.stale.providers);
  const reset = useAppStore((state) => state.providersReset);
  const clearStale = useAppStore((state) => state.clearStale);

  useEffect(() => {
    if (signedIn && owner !== serial) reset(serial);
  }, [signedIn, owner, serial, reset]);

  useEffect(() => {
    if (!active || !signedIn || owner !== serial || (status !== "idle" && !stale)) return;
    clearStale("providers");
    void flows.load();
  }, [active, signedIn, owner, serial, status, stale, flows, clearStale]);
}
