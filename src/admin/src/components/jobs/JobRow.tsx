import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { CELL_MONO, CELL_NAME, CELL_TEXT } from "@giga/ui/lists/record-grid-classes";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { StateWord } from "@/components/records/StateWord";
import { DELETE_TITLE } from "@/constants/job-copy";
import type { JobRowView } from "@/lib/job-rows";
import { RunningBar } from "./RunningBar";

export interface JobRowProps {
  readonly row: JobRowView;
  readonly ticked: boolean;
  /** Why Delete is disabled (running, unreachable, a call going); undefined when it works. */
  readonly deleteReason: string | undefined;
  readonly onTick: (id: number, on: boolean) => void;
  readonly onOpen: (id: number) => void;
  readonly onDelete: (id: number) => void;
}

/** One job of the list: the tick, the name, the type, the target (the playlist, or scope and kind), the schedule, the
 *  last run in mono (`never`), the outcome, the state word (`idle`, `running` with the pulsing 48px bar, `failed`,
 *  `disabled`, dimmed), and the end `Delete`, an armed two-step (deleting a job changes nothing it created). */
export function JobRow({ row, ticked, deleteReason, onTick, onOpen, onDelete }: JobRowProps) {
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
      <span className={CELL_NAME}>{row.name}</span>
      <span className={CELL_TEXT}>{row.type}</span>
      <span className={CELL_TEXT}>{row.target}</span>
      <span className={CELL_TEXT} title={row.schedule}>
        {row.schedule}
      </span>
      <span className={CELL_MONO}>{row.lastRun}</span>
      <span className={CELL_MONO} title={row.outcome}>
        {row.outcome}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <StateWord state={row.state} />
        {row.state.word === "running" && <RunningBar />}
      </span>
    </RecordGridRow>
  );
}
