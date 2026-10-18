import { Plus } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ADD_LABEL, ADD_TIP } from "@/constants/title-browse-copy";
import { addReason } from "@/lib/title-browse";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

export interface TitleAddButtonProps {
  readonly title: AdminTitleRow;
  /** An add is running: the button says `Adding.`. */
  readonly busy: boolean;
  readonly unreachable: boolean;
  readonly onAdd: () => void;
}

/** A Browse TMDB row's end `Add` (`docs/47` section 4): the explicit way a TMDB title becomes a stored one. Icon and word
 *  (`Plus`, `01` section 9), the tip at rest, and while it cannot run the reason in its place: `Already stored.`,
 *  `Deleted earlier; restore it under Deleted titles.`, `Adding.`, or the backend is unreachable. */
export function TitleAddButton({ title, busy, unreachable, onAdd }: TitleAddButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      title={ADD_TIP}
      reason={addReason(title, { busy, unreachable })}
      aria-label={`${ADD_LABEL} ${title.title}`}
      onClick={onAdd}
    >
      <Plus aria-hidden />
      {ADD_LABEL}
    </Button>
  );
}
