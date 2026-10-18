import { useCallback, useState } from "react";
import type { ProviderFlows } from "@/services/provider-flows";
import { useProviderFlows } from "./useProviderFlows";

/** The page's verbs over the flows, each marked busy for the length of its call so its control can say `Saving.`. The
 *  flows speak for themselves (notice, audit); this only tracks which call is running. Keys: `create`, `save`,
 *  `delete:<id>`, `refresh`. */
export interface ProviderActions {
  readonly flows: ProviderFlows;
  /** True while any write is running. */
  readonly saving: boolean;
  readonly isBusy: (key: string) => boolean;
  readonly track: <T>(key: string, call: () => Promise<T>) => Promise<T>;
}

export function useProviderActions(): ProviderActions {
  const flows = useProviderFlows();
  const [busy, setBusy] = useState<readonly string[]>([]);
  const track = useCallback(async <T>(key: string, call: () => Promise<T>): Promise<T> => {
    setBusy((keys) => [...keys, key]);
    try {
      return await call();
    } finally {
      setBusy((keys) => keys.filter((one) => one !== key));
    }
  }, []);
  const writes = busy.filter((key) => key !== "refresh");
  return { flows, saving: writes.length > 0, isBusy: (key) => busy.includes(key), track };
}
