import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { useAccountFlows } from "./useAccountFlows";

/** Loads the accounts when the tab is first shown after sign-in (status `idle`) and again when another tab's write marked
 *  them stale; never otherwise (staying on the tab does not reload it, `29` section 8). A failed first read leaves the
 *  status `failed`, so nothing retries by itself: the list's Refresh is the way back. */
export function useAccountsLoad(active: boolean): void {
  const flows = useAccountFlows();
  const status = useAppStore((state) => state.accounts.status);
  const stale = useAppStore((state) => state.stale.accounts);
  const clearStale = useAppStore((state) => state.clearStale);

  useEffect(() => {
    if (!active || (status !== "idle" && !stale)) return;
    clearStale("accounts");
    void flows.load();
  }, [active, status, stale, flows, clearStale]);
}
