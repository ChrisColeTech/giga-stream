import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { StateWord } from "@/components/records/StateWord";
import type { ChannelRowView } from "@/lib/channel-rows";

export interface ChannelRowProps {
  readonly row: ChannelRowView;
  readonly ticked: boolean;
  /** Why Delete is disabled (the backend unreachable, a call running); undefined when it works. */
  readonly deleteReason: string | undefined;
  readonly onTick: (id: string, on: boolean) => void;
  readonly onOpen: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

/** One channel of the list (`36` section 5.2): the tick, then name, category, kind, the state as a word, mode,
 *  what is on air, and the end `Delete`, an armed two-step naming the channel. A
 *  synced row's Delete says at rest that the next sync adds it again. A disabled channel stays, dimmed. A press on the
 *  cells opens the workspace; the tick and Delete sit outside that press. */
export function ChannelRow({ row, ticked, deleteReason, onTick, onOpen, onDelete }: ChannelRowProps) {
  return (
    <RecordGridRow
      state={row.state.word}
      dimmed={row.state.dimmed}
      ticked={ticked}
      tick={{ label: `Select ${row.name}`, onToggle: (on) => onTick(row.id, on) }}
      onOpen={() => onOpen(row.id)}
      end={
        <ArmedButton
          question={`Delete ${row.name}?`}
          disabled={deleteReason !== undefined}
          title={deleteReason ?? row.deleteTip}
          onConfirm={() => onDelete(row.id)}
        >
          Delete
        </ArmedButton>
      }
    >
      <span className="truncate text-text">{row.name}</span>
      <span className="truncate text-muted">{row.category}</span>
      <span className="truncate text-muted">{row.kind}</span>
      <StateWord state={row.state} />
      <span className="truncate text-muted">{row.mode}</span>
      <span className="truncate text-muted">{row.nowPlaying}</span>
    </RecordGridRow>
  );
}
