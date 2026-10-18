import { useMemo } from "react";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { ADD_LABEL } from "@/constants/title-browse-copy";
import { addBulkReason, planTitleAdd } from "@/lib/title-browse";
import type { BulkPlan } from "@/lib/bulk-plan";
import { createTitleAddCall } from "@/services/title-add-call";
import { titles } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";

export interface TitleAdd {
  /** The table strip's selection verb: `Add` over the ticked rows. */
  readonly verb: StripVerb;
  /** An add is running (the row buttons say `Adding.`). */
  readonly busy: boolean;
  /** Adds one row (its own `Add`). */
  readonly addRow: (id: string, name: string) => void;
}

/** Browse TMDB's explicit `Add` (`docs/47` sections 3.3 and 4), on a row and on the selection: each title is one
 *  `POST /api/titles/from-tmdb`, run one after the other by the shared bulk runner (a failure never stops the rest, one
 *  summary sentence, a warning per refusal). A title already stored or deleted is refused with its reason; the rows that
 *  were added read `stored` and the Stored list is read again when next shown. Nothing reads TMDB again. */
export function useTitleAdd(): TitleAdd {
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.titles.items);
  const ticked = useAppStore((state) => state.titles.ticked);
  const unreachable = useAppStore((state) => state.titles.unreachable);
  const call = useMemo(() => createTitleAddCall({ service: titles, store: () => useAppStore.getState() }), []);

  const run = (plan: BulkPlan<string>, nouns: { noun: string; nouns: string }): void => {
    void bulk.run({
      words: { past: "Added", ...nouns },
      area: "Title",
      plan,
      perform: call,
      finish: (outcome) => {
        const now = useAppStore.getState();
        now.titlesSetTicked(now.titles.ticked.filter((id) => !outcome.done.some((item) => item.id === id)));
      },
      reread: async () => undefined,
    });
  };
  const words = { noun: "title", nouns: "titles" };
  const plan = planTitleAdd(items, ticked);
  const verb: StripVerb = {
    id: "add",
    label: ADD_LABEL,
    icon: BULK_ICONS.add,
    tip: BULK_TIPS.add,
    reason: addBulkReason(plan, ticked.length, { busy: bulk.running, unreachable }),
    onPress: () => run(plan, words),
  };
  const addRow = (id: string, name: string): void => {
    run({ runnable: [{ id, label: name }], refused: [] }, words);
  };
  return { verb, busy: bulk.running, addRow };
}
