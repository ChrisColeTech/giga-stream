import type { Store } from "../store/store.js";
import type { EntryPlan } from "./playlist-sync-plan.js";

/**
 * Writes a plan into a playlist's rows and takes ONE revision when anything changed; a plan with nothing in it
 * writes nothing and bumps nothing (docs/43 section 3.2). Call it inside the caller's transaction. Answers whether
 * a row changed.
 */
export function applyPlan(store: Store, plan: EntryPlan, now: number): boolean {
  if (plan.creates.length + plan.updates.length === 0) return false;
  const revision = store.revisions.next();
  for (const record of plan.creates) store.channels.insert({ ...record, revision }, now);
  for (const record of plan.updates) store.channels.update({ ...record, revision });
  return true;
}
