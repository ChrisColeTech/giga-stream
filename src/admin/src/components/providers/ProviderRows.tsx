import { useMemo } from "react";
import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { DELETE_PROVIDER_TITLE, SAVING_REASON, UNREACHABLE_REASON } from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { providerRow, type ProviderRowView } from "@/lib/provider-rows";
import { useAppStore } from "@/store/app-store";
import { providerColumns } from "./provider-columns";

const idOf = (row: ProviderRowView): string => String(row.id);

/** The providers table (`37` section 3.2, `45`): a row per provider in `order`, then name (the headings re-sort them): the
 *  order in mono, the name, the source, the family, the state word (`enabled` or `disabled`, a disabled provider dimmed)
 *  and the end `Delete`, an armed two-step naming the provider. Skeleton rows draw while nothing has been read and when
 *  there is nothing to list (never a sentence). */
export function ProviderRows() {
  const { status, items, ticked, unreachable, session } = useAppStore((state) => state.providers);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.providerTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useProviderActions();
  const waiting = items.length === 0 || status === "idle" || session !== serial;
  const rows = useMemo(() => items.map(providerRow), [items]);

  const rowView = (row: ProviderRowView): RecordRowView => {
    const busy = saving || isBusy(`delete:${row.id}`);
    const reason = unreachable ? UNREACHABLE_REASON : busy ? SAVING_REASON : undefined;
    return {
      state: row.state.word,
      dimmed: row.state.dimmed,
      ticked: ticked.includes(row.id),
      tick: { label: `Select ${row.name}`, onToggle: (on) => tick(row.id, on) },
      onOpen: () => openWorkspace("providers", String(row.id)),
      end: (
        <ArmedButton
          question={`Delete ${row.name}?`}
          disabled={reason !== undefined}
          title={reason ?? DELETE_PROVIDER_TITLE}
          onConfirm={() => void track(`delete:${row.id}`, () => flows.remove(row.id))}
        >
          Delete
        </ArmedButton>
      ),
    };
  };

  return <RecordTable ariaLabel="Providers" columns={providerColumns} rows={rows} idOf={idOf} rowView={rowView} waiting={waiting} />;
}
