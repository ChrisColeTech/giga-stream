import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { StateWord } from "@/components/records/StateWord";
import { DELETE_TITLE } from "@/constants/playlist-copy";
import type { PlaylistRowView } from "@/lib/playlist-rows";

export interface PlaylistRowProps {
  readonly row: PlaylistRowView;
  readonly ticked: boolean;
  /** Why Delete is disabled (the backend unreachable, a call running); undefined when it works. */
  readonly deleteReason: string | undefined;
  readonly onTick: (id: number, on: boolean) => void;
  readonly onOpen: (id: number) => void;
  readonly onDelete: (id: number) => void;
}

/** One playlist of the list: the tick, the name, the host (never the address), the channel count in mono on the right,
 *  the last sync in mono (`never`), the state word, and the end `Delete`, an armed two-step whose rest title says the
 *  channels it created stay. A disabled playlist stays in the list, dimmed. */
export function PlaylistRow({ row, ticked, deleteReason, onTick, onOpen, onDelete }: PlaylistRowProps) {
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
          title={deleteReason ?? DELETE_TITLE}
          onConfirm={() => onDelete(row.id)}
        >
          Delete
        </ArmedButton>
      }
    >
      <span className="truncate text-text">{row.name}</span>
      <span className="truncate font-mono text-xs text-muted">{row.host}</span>
      <span className="truncate text-right font-mono text-xs text-muted tabular-nums">{row.channels}</span>
      <span className="truncate font-mono text-xs text-muted">{row.lastSynced}</span>
      <StateWord state={row.state} />
    </RecordGridRow>
  );
}
