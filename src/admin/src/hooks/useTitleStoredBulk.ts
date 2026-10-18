import { useMemo } from "react";
import { selectedCount } from "@giga/ui/lib/list-selection";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { TICK_FIRST } from "@/constants/record-copy";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/title-copy";
import {
  TITLE_BULK_LABELS,
  TITLE_BULK_ORDER,
  planTitleBulk,
  syncedCount,
  titleBulkReason,
  titleBulkWords,
  titleDeleteQuestion,
} from "@/lib/title-bulk";
import { sentenceOf } from "@/services/provider-flow-support";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { createTitleBulkCall } from "@/services/title-bulk";
import { resolveMatching } from "@/services/title-resolve";
import { titles } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useTitleFlows } from "./useTitleFlows";

/** The Stored list's bulk verbs over the ticked rows, which may span pages (`docs/41` section 4.5). The ticks are ids and the
 *  ticked rows are kept as they were last seen, so a verb plans over rows that are no longer loaded. After `Select all M
 *  matching` the whole result is read into memory first (a page of 200 at a time, the unticked rows dropped, `N syncing`
 *  in the statusbar while it reads); the plan, the armed two-step, the sequential run, the summary and the one re-read at
 *  the end are the shared piece's. The rows that did not finish stay ticked. */
export function useTitleStoredBulk(): readonly StripVerb[] {
  const flows = useTitleFlows();
  const bulk = useBulkAction();
  const { selection, picked, query, unreachable, paged } = useAppStore((state) => state.titlesStored);
  const call = useMemo(() => createTitleBulkCall({ service: titles, store: () => useAppStore.getState() }), []);
  const count = selectedCount(selection, paged.total ?? 0);
  const rows = Object.values(picked);
  const ids = selection.mode === "ids" ? [...selection.ids] : [];

  const resolve = async (): Promise<readonly AdminTitleRow[] | null> => {
    if (selection.mode === "ids") return rows;
    const store = useAppStore.getState();
    const serial = store.serial;
    store.setWork({ syncing: store.work.syncing + 1 });
    try {
      const read = await resolveMatching(titles, query, selection.except, () => useAppStore.getState().serial === serial);
      return useAppStore.getState().serial === serial ? read : null;
    } catch (error: unknown) {
      store.say(sentenceOf(error), "warn", "Title");
      return null;
    } finally {
      const now = useAppStore.getState();
      now.setWork({ syncing: Math.max(0, now.work.syncing - 1) });
    }
  };

  return TITLE_BULK_ORDER.map((verb): StripVerb => {
    const plan = planTitleBulk(verb, rows, ids);
    const reason =
      selection.mode === "ids"
        ? titleBulkReason(plan, ids.length, { busy: bulk.running, unreachable })
        : count === 0
          ? TICK_FIRST
          : bulk.running
            ? SAVING_REASON
            : unreachable
              ? UNREACHABLE_REASON
              : undefined;
    const press = async (): Promise<void> => {
      const read = await resolve();
      if (read === null) return;
      const run = planTitleBulk(verb, read, read.map((row) => row.id));
      await bulk.run({
        words: titleBulkWords(verb, syncedCount(run, read)),
        area: "Title",
        plan: run,
        perform: call(verb),
        finish: (outcome) => {
          const left = read.filter((row) => !outcome.done.some((item) => item.id === row.id));
          useAppStore.getState().storedKeepTicked(left);
        },
        reread: flows.refresh,
      });
    };
    return {
      id: verb,
      label: TITLE_BULK_LABELS[verb],
      icon: BULK_ICONS[verb],
      tip: BULK_TIPS[verb],
      reason,
      ...(verb === "delete" && { question: titleDeleteQuestion(selection.mode === "ids" ? plan.runnable.length : count) }),
      onPress: () => void press(),
    };
  });
}
