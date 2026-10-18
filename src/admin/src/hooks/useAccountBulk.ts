import { useMemo } from "react";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_DELETE, BULK_DISABLE, BULK_ENABLE } from "@/constants/account-copy";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { BULK_WORDS, bulkVerbReason, planAccountBulk, type AccountBulkVerb } from "@/lib/account-bulk";
import { sameId } from "@/lib/account-rows";
import type { BulkPlan } from "@/lib/bulk-plan";
import { accounts } from "@/services/accounts";
import { createAccountBulkCall } from "@/services/account-bulk";
import { useAppStore } from "@/store/app-store";
import type { AccountId } from "@/types/admin-account";
import { useAccountFlows } from "./useAccountFlows";
import { useBulkAction } from "./useBulkAction";

export interface AccountBulk {
  /** The table strip's verbs: icons with their reasons, and the armed Delete naming how many die. */
  readonly verbs: readonly StripVerb[];
}

const LABELS: Readonly<Record<AccountBulkVerb, string>> = {
  enable: BULK_ENABLE,
  disable: BULK_DISABLE,
  delete: BULK_DELETE,
};
const ORDER: readonly AccountBulkVerb[] = ["enable", "disable", "delete"];

/** The Accounts toolbar's bulk verbs over the ticked rows: Enable, Disable and Delete. Each verb's plan is computed from
 *  the list, the ticks and the signed-in account's id; a press runs it through the shared bulk runner, one single-account
 *  call per row, and unticks the rows that finished (a failed row stays ticked). */
export function useAccountBulk(): AccountBulk {
  const flows = useAccountFlows();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.accounts.items);
  const ticked = useAppStore((state) => state.accounts.ticked);
  const unreachable = useAppStore((state) => state.accounts.unreachable);
  const ownId = useAppStore((state) => state.actor?.id ?? null);
  const call = useMemo(
    () => createAccountBulkCall({ service: accounts, store: () => useAppStore.getState() }),
    [],
  );

  const verbs = ORDER.map((verb): StripVerb => {
    const plan: BulkPlan<AccountId> = planAccountBulk(verb, items, ticked, ownId);
    const count = plan.runnable.length;
    const press = (): void => {
      void bulk.run({
        words: BULK_WORDS[verb],
        area: "Account",
        plan,
        perform: call(verb),
        finish: (outcome) => {
          const now = useAppStore.getState();
          now.accountsSetTicked(now.accounts.ticked.filter((id) => !outcome.done.some((item) => sameId(item.id, id))));
        },
        reread: flows.refresh,
      });
    };
    return {
      id: verb,
      label: LABELS[verb],
      icon: BULK_ICONS[verb],
      tip: BULK_TIPS[verb],
      reason: bulkVerbReason(plan, ticked.length, { busy: bulk.running, unreachable }),
      ...(verb === "delete" && { question: `Delete ${count} ${count === 1 ? "account" : "accounts"}?` }),
      onPress: press,
    };
  });
  return { verbs };
}
