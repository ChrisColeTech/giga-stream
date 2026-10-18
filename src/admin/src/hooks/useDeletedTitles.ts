import { useMemo } from "react";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { planRestore, restoreReason, RESTORE_WORDS } from "@/lib/title-restore";
import { createTitleRestoreCall } from "@/services/title-bulk";
import { titles } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useTitleActions } from "./useTitleActions";

export interface DeletedTitles {
  /** The table strip's bulk verbs: `Restore` over the ticked rows, disabled with its reason. */
  readonly verbs: readonly StripVerb[];
  /** One row's `Restore`: why it is disabled (or undefined) and the press. */
  readonly row: (id: string) => { readonly reason: string | undefined; readonly press: () => void };
}

/** The Deleted titles group's verbs (`37` section 4.4): a row's own `Restore` through the flows, and the bulk `Restore`
 *  over the ticked rows through the shared bulk runner (rows that finished are unticked, the lists are read once at the
 *  end). Nothing is skipped: every ticked row runs. */
export function useDeletedTitles(): DeletedTitles {
  const { flows, saving, isBusy, track } = useTitleActions();
  const bulk = useBulkAction();
  const { items, ticked } = useAppStore((state) => state.titles.deleted);
  const unreachable = useAppStore((state) => state.titles.unreachable);
  const call = useMemo(() => createTitleRestoreCall({ service: titles, store: () => useAppStore.getState() }), []);
  const busy = bulk.running || saving;

  const press = (): void => {
    void bulk.run({
      words: RESTORE_WORDS,
      area: "Title",
      plan: planRestore(items, ticked),
      perform: call,
      finish: (outcome) => {
        const now = useAppStore.getState();
        now.titlesDeletedSetTicked(now.titles.deleted.ticked.filter((id) => !outcome.done.some((one) => one.id === id)));
      },
      reread: flows.refresh,
    });
  };
  return {
    verbs: [
      {
        id: "restore",
        label: "Restore",
        icon: BULK_ICONS.restore,
        tip: BULK_TIPS.restore,
        reason: restoreReason(ticked.length, { busy, unreachable }),
        onPress: press,
      },
    ],
    row: (id) => ({
      reason: restoreReason(1, { busy: busy || isBusy(`restore:${id}`), unreachable }),
      press: () => void track(`restore:${id}`, () => flows.restore(id)),
    }),
  };
}
