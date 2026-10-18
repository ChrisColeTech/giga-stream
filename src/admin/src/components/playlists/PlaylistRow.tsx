import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { CELL_MONO, CELL_NAME, CELL_NUMBER } from "@giga/ui/lists/record-grid-classes";
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

/** One playlist of the list: the tick, the name, the source (the masked host or the file name, never the address), the
 *  channel counts in mono on the right (all, enabled, live, dead), the last run in mono (`never`), the state word, and the
 *  end `Delete`, an armed two-step whose question names the channels that go with the playlist. A disabled playlist
 *  stays in the list, dimmed. */
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
          question={row.deleteQuestion}
          disabled={deleteReason !== undefined}
          title={deleteReason ?? DELETE_TITLE}
          onConfirm={() => onDelete(row.id)}
        >
          Delete
        </ArmedButton>
      }
    >
      <span className={CELL_NAME}>{row.name}</span>
      <span className={CELL_MONO}>{row.source}</span>
      <span className={CELL_NUMBER}>{row.channels}</span>
      <span className={CELL_NUMBER}>{row.enabled}</span>
      <span className={CELL_NUMBER}>{row.live}</span>
      <span className={CELL_NUMBER}>{row.dead}</span>
      <span className={CELL_MONO}>{row.lastRun}</span>
      <StateWord state={row.state} />
    </RecordGridRow>
  );
}
