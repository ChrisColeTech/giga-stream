import { useMemo } from "react";
import type { BulkNote } from "@/lib/bulk-plan";
import {
  PROVIDER_BULK_LABELS,
  PROVIDER_BULK_ORDER,
  PROVIDER_BULK_WORDS,
  deleteQuestion,
  planProviderBulk,
  providerBulkReason,
  type ProviderBulkVerb,
} from "@/lib/provider-bulk";
import { createProviderBulkCall } from "@/services/provider-bulk";
import { providers } from "@/services/providers";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useProviderFlows } from "./useProviderFlows";

export interface ProviderBulkView {
  readonly verb: ProviderBulkVerb;
  readonly label: string;
  /** Why it cannot run now; undefined when at least one ticked row can. */
  readonly reason: string | undefined;
  /** The armed question for Delete. */
  readonly question?: string;
  readonly press: () => void;
}

export interface ProviderBulk {
  readonly verbs: readonly ProviderBulkView[];
  readonly notes: readonly BulkNote[];
  readonly dismiss: () => void;
}

/** The Providers toolbar's bulk verbs over the ticked rows (`37` section 3.2): Enable, Disable and Delete, each planned
 *  from the list and the ticks and run through the shared bulk runner, one single-provider call per row; the rows that
 *  finished are unticked (a failed or skipped row stays ticked). */
export function useProviderBulk(): ProviderBulk {
  const flows = useProviderFlows();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.providers.items);
  const ticked = useAppStore((state) => state.providers.ticked);
  const unreachable = useAppStore((state) => state.providers.unreachable);
  const call = useMemo(() => createProviderBulkCall({ service: providers, store: () => useAppStore.getState() }), []);

  const verbs = PROVIDER_BULK_ORDER.map((verb): ProviderBulkView => {
    const plan = planProviderBulk(verb, items, ticked);
    const press = (): void => {
      void bulk.run({
        words: PROVIDER_BULK_WORDS[verb],
        area: "Provider",
        plan,
        perform: call(verb),
        finish: (outcome) => {
          const now = useAppStore.getState();
          now.providersSetTicked(now.providers.ticked.filter((id) => !outcome.done.some((item) => item.id === id)));
        },
        reread: flows.refresh,
      });
    };
    return {
      verb,
      label: PROVIDER_BULK_LABELS[verb],
      reason: providerBulkReason(verb, plan, ticked.length, { busy: bulk.running, unreachable }),
      ...(verb === "delete" && { question: deleteQuestion(plan.runnable.length) }),
      press,
    };
  });
  return { verbs, notes: bulk.notes, dismiss: bulk.dismiss };
}
