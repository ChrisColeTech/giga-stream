import { ImageIcon } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { SaveDetails } from "@/components/records/SaveDetails";
import type { SaveVerb } from "@/lib/workspace-verbs";
import { BACKDROP_TIP, POSTER_TIP } from "@/constants/title-copy";
import type { FormErrors } from "@/lib/record-form";
import type { TitleDraft } from "@/lib/title-draft";
import { TitleTextRow } from "./TitleTextRow";

export interface TitleImagesGroupProps {
  readonly draft: TitleDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<TitleDraft>) => void;
  /** Present on a movie's page, where this is the last group and ends with the form's commit (a series ends on Seasons). */
  readonly save?: SaveVerb;
}

/** `Images` (`37` section 4.3): the Poster and Backdrop addresses; the backend checks them against its address rule. On
 *  a movie's page it is the last group and ends with `Save details`. */
export function TitleImagesGroup({ draft, errors, onChange, save }: TitleImagesGroupProps) {
  return (
    <Group id="tw-images" icon={ImageIcon} title="Images" last={save !== undefined}>
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
      {save !== undefined && <SaveDetails save={save} />}
    </Group>
  );
}
