import { Eye } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { PREVIEW_TITLE_TOOLTIP, UNREACHABLE_REASON } from "@/constants/title-copy";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { TitleDeleteButton } from "./TitleDeleteButton";

export interface TitleActionsProps {
  readonly title: AdminTitleRow;
  /** A write is running (this row's Delete, or any save): the Delete says `Saving.`. */
  readonly busy: boolean;
  readonly unreachable: boolean;
  readonly onPreview: (titleId: string) => void;
  readonly onDelete: () => void;
}

/** The end cell of a stored title row (`55` decision 4), the channels' own eye beside the armed `Delete`:
 *  `Preview title` opens the title preview window for this row. The eye is ABSENT - never disabled - for a title with no
 *  TMDB id (every provider source is built from one, so there is nothing to preview), and disabled with its reason while
 *  the backend cannot be reached. */
export function TitleActions({ title, busy, unreachable, onPreview, onDelete }: TitleActionsProps) {
  return (
    <span className="flex items-center gap-1">
      {title.tmdbId !== undefined && (
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          aria-label={PREVIEW_TITLE_TOOLTIP}
          title={unreachable ? undefined : PREVIEW_TITLE_TOOLTIP}
          reason={unreachable ? UNREACHABLE_REASON : undefined}
          onClick={() => onPreview(title.id)}
        >
          <Eye aria-hidden />
        </Button>
      )}
      <TitleDeleteButton title={title} busy={busy} unreachable={unreachable} onDelete={onDelete} />
    </span>
  );
}