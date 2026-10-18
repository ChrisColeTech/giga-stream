import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { StateWord } from "@/components/records/StateWord";
import {
  DELETE_MANUAL_TITLE,
  DELETE_SYNCED_TITLE,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/title-copy";
import { titleRow } from "@/lib/title-rows";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

export interface TitleRowItemProps {
  readonly title: AdminTitleRow;
  readonly ticked: boolean;
  readonly onTick: (on: boolean) => void;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
  /** A write is running (this row's Delete, or any save): the Delete says `Saving.`. */
  readonly busy: boolean;
  readonly unreachable: boolean;
}

/** One title row (`37` section 4.2), the same in the Stored list and the TMDB browse list: the title, the kind, the year
 *  and rating in mono, the state word (`edited` with a tip naming the edited fields, `disabled` dimmed) and the end
 *  `Delete`, an armed two-step whose rest title says what it does to a synced or a hand-made title. */
export function TitleRowItem({ title, ticked, onTick, onOpen, onDelete, busy, unreachable }: TitleRowItemProps) {
  const row = titleRow(title);
  const reason = unreachable ? UNREACHABLE_REASON : busy ? SAVING_REASON : undefined;
  const word = <StateWord state={row.state} />;
  return (
    <RecordGridRow
      state={row.state.word}
      dimmed={row.state.dimmed}
      ticked={ticked}
      tick={{ label: `Select ${row.title}`, onToggle: onTick }}
      onOpen={onOpen}
      end={
        <ArmedButton
          question={`Delete ${row.title}?`}
          disabled={reason !== undefined}
          title={reason ?? (row.manual ? DELETE_MANUAL_TITLE : DELETE_SYNCED_TITLE)}
          onConfirm={onDelete}
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
}
