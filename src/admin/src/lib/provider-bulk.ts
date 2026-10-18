import {
  ALREADY_DISABLED,
  ALREADY_ENABLED,
  EVERY_DISABLED,
  EVERY_ENABLED,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/provider-copy";
import { TICK_FIRST } from "@/constants/record-copy";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { planBulk, type BulkItem, type BulkPlan, type BulkWords } from "./bulk-plan";

/* The Providers toolbar's bulk verbs (`37` section 3.2, `39` section 6), pure: Enable and Disable skip a provider
 * already in that state; Delete runs on every ticked row. */

export type ProviderBulkVerb = "enable" | "disable" | "delete";

export const PROVIDER_BULK_ORDER: readonly ProviderBulkVerb[] = ["enable", "disable", "delete"];

export const PROVIDER_BULK_LABELS: Readonly<Record<ProviderBulkVerb, string>> = {
  enable: "Enable",
  disable: "Disable",
  delete: "Delete",
};

export const PROVIDER_BULK_WORDS: Readonly<Record<ProviderBulkVerb, BulkWords>> = {
  enable: { past: "Enabled", noun: "provider", nouns: "providers" },
  disable: { past: "Disabled", noun: "provider", nouns: "providers" },
  delete: { past: "Deleted", noun: "provider", nouns: "providers" },
};

const EVERY: Readonly<Record<ProviderBulkVerb, string | undefined>> = {
  enable: EVERY_ENABLED,
  disable: EVERY_DISABLED,
  delete: undefined,
};

/** The ticked providers in list order, as the plan's items. */
export const tickedProviders = (items: readonly AdminProvider[], ticked: readonly number[]): BulkItem<number>[] =>
  items.filter((item) => ticked.includes(item.id)).map((item) => ({ id: item.id, label: item.name }));

export function planProviderBulk(
  verb: ProviderBulkVerb,
  items: readonly AdminProvider[],
  ticked: readonly number[],
): BulkPlan<number> {
  return planBulk(tickedProviders(items, ticked), (item) => {
    const provider = items.find((one) => one.id === item.id);
    if (provider === undefined || verb === "delete") return null;
    if (verb === "enable") return provider.is_active ? ALREADY_ENABLED : null;
    return provider.is_active ? null : ALREADY_DISABLED;
  });
}

/** Why a bulk verb is disabled, or undefined: nothing ticked, a run or a write going, the backend unreachable, or every
 *  ticked row skipped (then the verb's own sentence: `Every ticked provider is already enabled.`). */
export function providerBulkReason(
  verb: ProviderBulkVerb,
  plan: BulkPlan<number>,
  tickedCount: number,
  state: { readonly busy: boolean; readonly unreachable: boolean },
): string | undefined {
  if (tickedCount === 0) return TICK_FIRST;
  if (state.busy) return SAVING_REASON;
  if (state.unreachable) return UNREACHABLE_REASON;
  if (plan.runnable.length > 0) return undefined;
  return EVERY[verb] ?? plan.refused[0]?.reason;
}

/** The armed question of the toolbar's Delete: it names how many die. */
export const deleteQuestion = (count: number): string => `Delete ${count} ${count === 1 ? "provider" : "providers"}?`;
