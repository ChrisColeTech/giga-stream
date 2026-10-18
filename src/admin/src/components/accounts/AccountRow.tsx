import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { StateWord } from "@/components/records/StateWord";
import { DELETE_TITLE } from "@/constants/account-copy";
import type { AccountRowView } from "@/lib/account-rows";
import type { AccountId } from "@/types/admin-account";

export interface AccountRowProps {
  readonly row: AccountRowView;
  readonly ticked: boolean;
  /** Why Delete is disabled (the last enabled account, the backend unreachable, a call running); undefined when it works. */
  readonly deleteReason: string | undefined;
  readonly onTick: (id: AccountId, on: boolean) => void;
  readonly onOpen: (id: AccountId) => void;
  readonly onDelete: (id: AccountId) => void;
}

/** One account of the list: the tick, the username, the state as a word, the last sign-in in mono (`never` if it has
 *  not signed in), and the end `Delete`, an armed two-step naming who dies (`Delete ed@example.test?`). A disabled account
 *  stays in the list, dimmed. A press on the cells opens the workspace; the tick and Delete sit outside that press. */
export function AccountRow({ row, ticked, deleteReason, onTick, onOpen, onDelete }: AccountRowProps) {
  return (
    <RecordGridRow
      state={row.state.word}
      dimmed={row.state.dimmed}
      ticked={ticked}
      tick={{ label: `Select ${row.username}`, onToggle: (on) => onTick(row.id, on) }}
      onOpen={() => onOpen(row.id)}
      end={
        <ArmedButton
          question={`Delete ${row.username}?`}
          disabled={deleteReason !== undefined}
          title={deleteReason ?? DELETE_TITLE}
          onConfirm={() => onDelete(row.id)}
        >
          Delete
        </ArmedButton>
      }
    >
      <span className="truncate text-text">{row.username}</span>
      <StateWord state={row.state} />
      <span className="truncate font-mono text-xs text-muted">{row.when}</span>
    </RecordGridRow>
  );
}
