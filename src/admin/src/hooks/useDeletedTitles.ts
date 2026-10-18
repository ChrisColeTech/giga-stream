import { useMemo } from "react";
import type { BulkNote } from "@/lib/bulk-plan";
import { planRestore, restoreReason, RESTORE_WORDS } from "@/lib/title-restore";
import { createTitleRestoreCall } from "@/services/title-bulk";
import { titles } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useTitleActions } from "./useTitleActions";

export interface DeletedTitles {
  /** Bulk `Restore` over the ticked rows: why it is disabled (or undefined) and the press. */
  readonly bulk: { readonly reason: string | undefined; readonly press: () => void };
  readonly notes: readonly BulkNote[];
  readonly dismiss: () => void;
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
    bulk: { reason: restoreReason(ticked.length, { busy, unreachable }), press },
    notes: bulk.notes,
    dismiss: bulk.dismiss,
    row: (id) => ({
      reason: restoreReason(1, { busy: busy || isBusy(`restore:${id}`), unreachable }),
      press: () => void track(`restore:${id}`, () => flows.restore(id)),
    }),
  };
}
