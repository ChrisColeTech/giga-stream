import { ImageIcon } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { BACKDROP_TIP, POSTER_TIP } from "@/constants/title-copy";
import type { FormErrors } from "@/lib/record-form";
import type { TitleDraft } from "@/lib/title-draft";
import { TitleTextRow } from "./TitleTextRow";

export interface TitleImagesGroupProps {
  readonly draft: TitleDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<TitleDraft>) => void;
  /** The last group of a movie's page (a series ends on Seasons). */
  readonly last: boolean;
}

/** `Images` (`37` section 4.3): the Poster and Backdrop addresses; the backend checks them against its address rule. */
export function TitleImagesGroup({ draft, errors, onChange, last }: TitleImagesGroupProps) {
  return (
    <Group id="tw-images" icon={ImageIcon} title="Images" last={last}>
      <TitleTextRow
        label="Poster address"
        tip={POSTER_TIP}
        value={draft.posterUrl}
        error={errors["posterUrl"]}
        onChange={(posterUrl) => onChange({ posterUrl })}
      />
      <TitleTextRow
        label="Backdrop address"
        tip={BACKDROP_TIP}
        value={draft.backdropUrl}
        error={errors["backdropUrl"]}
        onChange={(backdropUrl) => onChange({ backdropUrl })}
      />
    </Group>
  );
}
