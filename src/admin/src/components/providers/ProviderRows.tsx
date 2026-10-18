import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { StateWord } from "@/components/records/StateWord";
import { DELETE_PROVIDER_TITLE, SAVING_REASON, UNREACHABLE_REASON } from "@/constants/provider-copy";
import { PROVIDER_GRID, PROVIDER_HEADINGS } from "@/constants/provider-grid";
import { useProviderActions } from "@/hooks/useProviderActions";
import { providerRow } from "@/lib/provider-rows";
import { useAppStore } from "@/store/app-store";

/** The providers grid (`37` section 3.2): the header with its select-all tick, then a row per provider in `order`, then
 *  name: the order in mono, the name, the source, the family, the state word (`enabled` or `disabled`, a disabled
 *  provider dimmed) and the end `Delete`, an armed two-step naming the provider. Shimmer rows in the header's own
 *  columns draw while nothing has been read and when there is nothing to list (never a sentence). */
export function ProviderRows() {
  const { status, items, ticked, unreachable, session } = useAppStore((state) => state.providers);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.providerTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useProviderActions();
  const waiting = items.length === 0 || status === "idle" || session !== serial;

  return (
    <RecordGrid
      ariaLabel="Providers"
      layout={PROVIDER_GRID}
      headings={PROVIDER_HEADINGS}
      ticks
    >
      {waiting ? (
        <SkeletonGrid />
      ) : (
        items.map((provider) => {
          const row = providerRow(provider);
          const busy = saving || isBusy(`delete:${row.id}`);
          const reason = unreachable ? UNREACHABLE_REASON : busy ? SAVING_REASON : undefined;
          return (
            <RecordGridRow
              key={row.id}
              state={row.state.word}
              dimmed={row.state.dimmed}
              ticked={ticked.includes(row.id)}
              tick={{ label: `Select ${row.name}`, onToggle: (on) => tick(row.id, on) }}
              onOpen={() => openWorkspace("providers", String(row.id))}
              end={
                <ArmedButton
                  question={`Delete ${row.name}?`}
                  disabled={reason !== undefined}
                  title={reason ?? DELETE_PROVIDER_TITLE}
                  onConfirm={() => void track(`delete:${row.id}`, () => flows.remove(row.id))}
                >
                  Delete
                </ArmedButton>
              }
            >
              <span className="truncate text-right font-mono text-xs text-muted">{row.order}</span>
              <span className="truncate text-text">{row.name}</span>
              <span className="truncate font-mono text-xs text-muted">{row.source}</span>
              <span className="truncate text-muted">{row.family}</span>
              <StateWord state={row.state} />
            </RecordGridRow>
          );
        })
      )}
    </RecordGrid>
  );
}
