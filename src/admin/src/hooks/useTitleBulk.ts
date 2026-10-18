import { useMemo } from "react";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import {
  TITLE_BULK_LABELS,
  TITLE_BULK_ORDER,
  planTitleBulk,
  syncedCount,
  titleBulkReason,
  titleBulkWords,
  titleDeleteQuestion,
} from "@/lib/title-bulk";
import { createTitleBulkCall } from "@/services/title-bulk";
import { titles } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useTitleFlows } from "./useTitleFlows";

export interface TitleBulk {
  /** The table strip's verbs; Delete carries its armed question. */
  readonly verbs: readonly StripVerb[];
}

/** The Titles table strip's bulk verbs over the ticked rows (`37` section 4.2): Enable, Disable, Revert to TMDB and Delete
 *  (manual and synced alike), each planned from the page's rows and run through the shared bulk runner; the rows that
 *  finished are unticked. Delete's summary names how many deleted titles were synced and stay deleted. */
export function useTitleBulk(): TitleBulk {
  const flows = useTitleFlows();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.titles.items);
  const ticked = useAppStore((state) => state.titles.ticked);
  const unreachable = useAppStore((state) => state.titles.unreachable);
  const call = useMemo(() => createTitleBulkCall({ service: titles, store: () => useAppStore.getState() }), []);

  const verbs = TITLE_BULK_ORDER.map((verb): StripVerb => {
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
      id: verb,
      label: TITLE_BULK_LABELS[verb],
      icon: BULK_ICONS[verb],
      tip: BULK_TIPS[verb],
      reason: titleBulkReason(plan, ticked.length, { busy: bulk.running, unreachable }),
      ...(verb === "delete" && { question: titleDeleteQuestion(plan.runnable.length) }),
      onPress: press,
    };
  });
  return { verbs };
}
