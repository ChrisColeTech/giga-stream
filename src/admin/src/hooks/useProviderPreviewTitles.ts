import { useEffect } from "react";
import { loadedRows } from "@/lib/title-paged";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { useTitleFlows } from "./useTitleFlows";

export interface ProviderPreviewTitles {
  /** The stored titles the app holds: the Stored list's loaded pages, in the list's own order. */
  readonly rows: readonly AdminTitleRow[];
  /** The first page is still being read (or never was): the stage wears its skeleton and the select waits. */
  readonly reading: boolean;
  /** The read failed and nothing is held. */
  readonly failed: boolean;
}

/** The provider preview's `Title` dropdown (`55` decision 7): the stored titles the app already holds. The window
 *  ensures the Stored list's FIRST page once, through that list's own reads - `loadStored` when the list was never read,
 *  `needRange(0, 0)` when only its first page is missing - never a new route, and never the list's own filter state.
 *  Pages the list already holds are offered as they are; nothing reads again by itself (no timer, no poll). */
export function useProviderPreviewTitles(): ProviderPreviewTitles {
  const flows = useTitleFlows();
  const paged = useAppStore((state) => state.titlesStored.paged);
  const status = useAppStore((state) => state.titlesStored.status);

  useEffect(() => {
    const stored = useAppStore.getState().titlesStored;
    if (stored.paged.total === null) void flows.loadStored();
    else void flows.needRange(0, 0);
  }, [flows]);

  const held = paged.pages[0];
  return {
    rows: loadedRows(paged),
    reading: held === undefined && status !== "failed",
    failed: held === undefined && status === "failed",
  };
}