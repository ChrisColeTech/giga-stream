import { END_ACTIONS_PX } from "@giga/ui/lib/window-constants";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useProviderPreviewOpen } from "@/hooks/useProviderPreviewOpen";
import { useProviderView } from "@/hooks/useProviderView";
import type { ProviderRowView } from "@/lib/provider-rows";
import { useAppStore } from "@/store/app-store";
import { ProviderActions } from "./ProviderActions";
import { providerColumns } from "./provider-columns";

const idOf = (row: ProviderRowView): string => String(row.id);

/** The providers table (`37` section 3.2, `45`): a row per provider in `order`, then name (the headings re-sort them): the
 *  order in mono, the name, the host (`55` decision 3), the family, the state word (`enabled` or `disabled`, a disabled
 *  provider dimmed) and the end `Preview` eye (an embed provider with a template only) before the armed `Delete`, an
 *  armed two-step naming the provider. Skeleton rows draw while nothing has been read and when there is nothing to list
 *  (never a sentence). */
export function ProviderRows() {
  const { status, items, ticked, unreachable, session } = useAppStore((state) => state.providers);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.providerTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const openPreview = useProviderPreviewOpen();
  const { flows, saving, isBusy, track } = useProviderActions();
  const { visible, sort } = useProviderView();
  const waiting = items.length === 0 || status === "idle" || session !== serial;

  const rowView = (row: ProviderRowView): RecordRowView => {
    const busy = saving || isBusy(`delete:${row.id}`);
    const reason = unreachable ? UNREACHABLE_REASON : busy ? SAVING_REASON : undefined;
    const provider = items.find((item) => item.id === row.id);
    return {
      state: row.state.word,
      dimmed: row.state.dimmed,
      ticked: ticked.includes(row.id),
      tick: { label: `Select ${row.name}`, onToggle: (on) => tick(row.id, on) },
      onOpen: () => openWorkspace("providers", String(row.id)),
      end:
        provider === undefined ? null : (
          <ProviderActions
            provider={provider}
            deleteReason={reason}
            previewReason={unreachable ? UNREACHABLE_REASON : undefined}
            onPreview={openPreview}
            onDelete={() => void track(`delete:${row.id}`, () => flows.remove(row.id))}
          />
        ),
    };
  };

  return (
    <RecordTable
      ariaLabel="Providers"
      columns={providerColumns}
      rows={visible}
      idOf={idOf}
      rowView={rowView}
      waiting={waiting}
      sort={sort}
      endPx={END_ACTIONS_PX}
    />
  );
}
