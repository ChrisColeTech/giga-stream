import type { AdminProvider } from "@/services/schemas/provider-schema";
import { enabledState, type RowState } from "./row-state";

/* The providers list as pure data: the order the list shows (by `order`, then name), the row a list draws, the ticks and
 * the select-all state. No React, no store. */

const byOrderThenName = (a: AdminProvider, b: AdminProvider): number =>
  a.order - b.order || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id - b.id;

export const sortedProviders = (items: readonly AdminProvider[]): AdminProvider[] => [...items].sort(byOrderThenName);

/** A write's answer put into the list: replaces the provider with that id, or adds it; kept in order. */
export const upsertProvider = (items: readonly AdminProvider[], provider: AdminProvider): AdminProvider[] =>
  sortedProviders([...items.filter((item) => item.id !== provider.id), provider]);

export const withoutProvider = (items: readonly AdminProvider[], id: number): AdminProvider[] =>
  items.filter((item) => item.id !== id);

export const findProvider = (items: readonly AdminProvider[], id: number): AdminProvider | undefined =>
  items.find((item) => item.id === id);

/** Only the ticks that still name a row: a row that goes takes its tick with it. */
export const pruneProviderTicks = (ticked: readonly number[], items: readonly AdminProvider[]): number[] =>
  ticked.filter((id) => items.some((item) => item.id === id));

export function providerSelectAll(items: readonly AdminProvider[], ticked: readonly number[]): boolean | "mixed" {
  const count = items.filter((item) => ticked.includes(item.id)).length;
  if (count === 0) return false;
  return count === items.length ? true : "mixed";
}

export interface ProviderRowView {
  readonly id: number;
  readonly order: string;
  readonly name: string;
  readonly source: string;
  readonly family: string;
  readonly state: RowState;
}

export function providerRow(provider: AdminProvider): ProviderRowView {
  return {
    id: provider.id,
    order: String(provider.order),
    name: provider.name,
    source: provider.source,
    family: provider.family === "embed" ? "Embed" : "Stream",
    state: enabledState(provider.is_active),
  };
}

/** The Created fact: `YYYY-MM-DD HH:mm` in the machine's zone, from the backend's ISO time. */
export function createdAt(iso: string): number | undefined {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}
