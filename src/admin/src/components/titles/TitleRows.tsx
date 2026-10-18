import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { StateWord } from "@/components/records/StateWord";
import {
  DELETE_MANUAL_TITLE,
  DELETE_SYNCED_TITLE,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/title-copy";
import { TITLE_GRID, TITLE_HEADINGS } from "@/constants/title-grid";
import { useTitleActions } from "@/hooks/useTitleActions";
import { titleRow, titleSelectAll } from "@/lib/title-rows";
import { useAppStore } from "@/store/app-store";

/** The titles grid (`37` section 4.2): the header with its select-all tick, then a row per title in the backend's
 *  order: the title, the kind, the year and rating in mono, the state word (`synced`, `edited` with a tip naming the
 *  edited fields, `manual`, or `disabled`, dimmed) and the end `Delete`, an armed two-step whose rest title for a
 *  synced title says it stays deleted and points to Deleted titles. Shimmer rows while nothing is read, while a
 *  read fails with no rows (no TMDB token) and when there is nothing to list; never a sentence. */
export function TitleRows() {
  const { status, items, ticked, unreachable, session } = useAppStore((state) => state.titles);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.titleTick);
  const tickAll = useAppStore((state) => state.titlesTickAll);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useTitleActions();
  const waiting = items.length === 0 || status === "idle" || session !== serial;

  return (
    <RecordGrid
      ariaLabel="Titles"
      layout={TITLE_GRID}
      headings={TITLE_HEADINGS}
      selection={{ label: "Select all titles", checked: titleSelectAll(items, ticked), onToggle: tickAll }}
    >
      {waiting ? (
        <SkeletonGrid />
      ) : (
        items.map((title) => {
          const row = titleRow(title);
          const busy = saving || isBusy(`delete:${row.id}`);
          const reason = unreachable ? UNREACHABLE_REASON : busy ? SAVING_REASON : undefined;
          const word = <StateWord state={row.state} />;
          return (
            <RecordGridRow
              key={row.id}
              state={row.state.word}
              dimmed={row.state.dimmed}
              ticked={ticked.includes(row.id)}
              tick={{ label: `Select ${row.title}`, onToggle: (on) => tick(row.id, on) }}
              onOpen={() => openWorkspace("titles", row.id)}
              end={
                <ArmedButton
                  question={`Delete ${row.title}?`}
                  disabled={reason !== undefined}
                  title={reason ?? (row.manual ? DELETE_MANUAL_TITLE : DELETE_SYNCED_TITLE)}
                  onConfirm={() => void track(`delete:${row.id}`, () => flows.remove(row.id))}
                >
                  Delete
                </ArmedButton>
              }
            >
              <span className="truncate text-text">{row.title}</span>
              <span className="truncate text-muted">{row.kind}</span>
              <span className="truncate text-right font-mono text-xs text-muted">{row.year}</span>
              <span className="truncate text-right font-mono text-xs text-muted">{row.rating}</span>
              {row.stateTip === undefined ? word : <Tooltip text={row.stateTip}>{word}</Tooltip>}
            </RecordGridRow>
          );
        })
      )}
    </RecordGrid>
  );
}
