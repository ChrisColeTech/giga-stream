import { useMemo } from "react";
import type { BulkNote } from "@/lib/bulk-plan";
import {
  TITLE_BULK_LABELS,
  TITLE_BULK_ORDER,
  planTitleBulk,
  syncedCount,
  titleBulkReason,
  titleBulkWords,
  titleDeleteQuestion,
  type TitleBulkVerb,
} from "@/lib/title-bulk";
import { createTitleBulkCall } from "@/services/title-bulk";
import { titles } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useTitleFlows } from "./useTitleFlows";

export interface TitleBulkView {
  readonly verb: TitleBulkVerb;
  readonly label: string;
  readonly reason: string | undefined;
  readonly question?: string;
  readonly press: () => void;
}

export interface TitleBulk {
  readonly verbs: readonly TitleBulkView[];
  readonly notes: readonly BulkNote[];
  readonly dismiss: () => void;
}

/** The Titles toolbar's bulk verbs over the ticked rows (`37` section 4.2): Enable, Disable, Revert to TMDB and Delete
 *  (manual and synced alike), each planned from the page's rows and run through the shared bulk runner; the rows that
 *  finished are unticked. Delete's summary names how many deleted titles were synced and come back. */
export function useTitleBulk(): TitleBulk {
  const flows = useTitleFlows();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.titles.items);
  const ticked = useAppStore((state) => state.titles.ticked);
  const unreachable = useAppStore((state) => state.titles.unreachable);
  const call = useMemo(() => createTitleBulkCall({ service: titles, store: () => useAppStore.getState() }), []);

  const verbs = TITLE_BULK_ORDER.map((verb): TitleBulkView => {
    const plan = planTitleBulk(verb, items, ticked);
    const press = (): void => {
      void bulk.run({
        words: titleBulkWords(verb, syncedCount(plan, items)),
        area: "Title",
        plan,
        perform: call(verb),
        finish: (outcome) => {
          const now = useAppStore.getState();
          now.titlesSetTicked(now.titles.ticked.filter((id) => !outcome.done.some((item) => item.id === id)));
        },
        reread: flows.refresh,
      });
    };
    return {
      verb,
      label: TITLE_BULK_LABELS[verb],
      reason: titleBulkReason(plan, ticked.length, { busy: bulk.running, unreachable }),
      ...(verb === "delete" && { question: titleDeleteQuestion(plan.runnable.length) }),
      press,
    };
  });
  return { verbs, notes: bulk.notes, dismiss: bulk.dismiss };
}
