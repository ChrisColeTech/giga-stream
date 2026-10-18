import { useMemo } from "react";
import { providerSpec } from "@/lib/list-specs";
import { providerRow, type ProviderRowView } from "@/lib/provider-rows";
import { useAppStore } from "@/store/app-store";
import { useListQuery, type ListQueryView } from "./useListQuery";

const idOf = (row: ProviderRowView): string => String(row.id);

function retain(keep: (id: string) => boolean): void {
  const state = useAppStore.getState();
  state.providersSetTicked(state.providers.ticked.filter((id) => keep(String(id))));
}

/** The Providers list as the query shows it: every provider's row, filtered and sorted (`lib/list-query.ts`). */
export function useProviderView(): ListQueryView<ProviderRowView> {
  const items = useAppStore((state) => state.providers.items);
  const rows = useMemo(() => items.map(providerRow), [items]);
  return useListQuery({ list: "providers", rows, spec: providerSpec, idOf, retain });
}
