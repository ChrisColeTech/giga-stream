import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import {
  DELETE_MANUAL_TITLE,
  DELETE_SYNCED_TITLE,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/title-copy";
import { isManualTitle } from "@/lib/title-rows";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

export interface TitleDeleteButtonProps {
  readonly title: AdminTitleRow;
  /** A write is running (this row's Delete, or any save): the Delete says `Saving.`. */
  readonly busy: boolean;
  readonly unreachable: boolean;
  readonly onDelete: () => void;
}

/** A title row's end `Delete`: an armed two-step whose rest title says what it does to a synced or a hand-made title. */
export function TitleDeleteButton({ title, busy, unreachable, onDelete }: TitleDeleteButtonProps) {
  const reason = unreachable ? UNREACHABLE_REASON : busy ? SAVING_REASON : undefined;
  return (
    <ArmedButton
      question={`Delete ${title.title}?`}
      disabled={reason !== undefined}
      title={reason ?? (isManualTitle(title) ? DELETE_MANUAL_TITLE : DELETE_SYNCED_TITLE)}
      onConfirm={onDelete}
    >
      Delete
    </ArmedButton>
  );
}
