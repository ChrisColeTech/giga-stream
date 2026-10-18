import { useMemo } from "react";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_ICONS } from "@/constants/bulk-icons";
import {
  PROVIDER_BULK_LABELS,
  PROVIDER_BULK_ORDER,
  PROVIDER_BULK_WORDS,
  deleteQuestion,
  planProviderBulk,
  providerBulkReason,
} from "@/lib/provider-bulk";
import { createProviderBulkCall } from "@/services/provider-bulk";
import { providers } from "@/services/providers";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useProviderFlows } from "./useProviderFlows";

export interface ProviderBulk {
  /** The table strip's verbs; Delete carries its armed question. */
  readonly verbs: readonly StripVerb[];
}

/** The Providers table strip's bulk verbs over the ticked rows (`37` section 3.2): Enable, Disable and Delete, each planned
 *  from the list and the ticks and run through the shared bulk runner, one single-provider call per row; the rows that
 *  finished are unticked (a failed or skipped row stays ticked). */
export function useProviderBulk(): ProviderBulk {
  const flows = useProviderFlows();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.providers.items);
  const ticked = useAppStore((state) => state.providers.ticked);
  const unreachable = useAppStore((state) => state.providers.unreachable);
  const call = useMemo(() => createProviderBulkCall({ service: providers, store: () => useAppStore.getState() }), []);

  const verbs = PROVIDER_BULK_ORDER.map((verb): StripVerb => {
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
      id: verb,
      label: PROVIDER_BULK_LABELS[verb],
      icon: BULK_ICONS[verb],
      reason: providerBulkReason(verb, plan, ticked.length, { busy: bulk.running, unreachable }),
      ...(verb === "delete" && { question: deleteQuestion(plan.runnable.length) }),
      onPress: press,
    };
  });
  return { verbs };
}
