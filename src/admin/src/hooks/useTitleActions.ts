import { useCallback, useState } from "react";
import type { TitleFlows } from "@/services/title-flows";
import { useTitleFlows } from "./useTitleFlows";

/** The page's verbs over the flows, each marked busy for the length of its call so its control can say `Saving.`. Keys:
 *  `create`, `save`, `revert`, `delete:<id>`, `read` (a list read). */
export interface TitleActions {
  readonly flows: TitleFlows;
  /** True while any write is running. */
  readonly saving: boolean;
  readonly isBusy: (key: string) => boolean;
  readonly track: <T>(key: string, call: () => Promise<T>) => Promise<T>;
}

export function useTitleActions(): TitleActions {
  const flows = useTitleFlows();
  const [busy, setBusy] = useState<readonly string[]>([]);
  const track = useCallback(async <T>(key: string, call: () => Promise<T>): Promise<T> => {
    setBusy((keys) => [...keys, key]);
    try {
      return await call();
    } finally {
      setBusy((keys) => keys.filter((one) => one !== key));
    }
  }, []);
  const writes = busy.filter((key) => key !== "read");
  return { flows, saving: writes.length > 0, isBusy: (key) => busy.includes(key), track };
}
