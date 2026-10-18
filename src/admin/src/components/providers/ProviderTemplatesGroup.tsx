import { Link } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { EPISODE_TEMPLATE_TIP, START_PARAM_TIP, SUBTITLES_PARAM_TIP } from "@/constants/provider-copy";
import { showsTemplates, type ProviderDraft } from "@/lib/provider-draft";
import type { FormErrors } from "@/lib/record-form";
import { ProviderTextRow } from "./ProviderTextRow";

export interface ProviderTemplatesGroupProps {
  readonly draft: ProviderDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<ProviderDraft>) => void;
}

/** `Templates` (`37` section 3.3): the Episode template (an embed provider only; its tip names the `{tmdbId}`,
 *  `{season}` and `{episode}` placeholders), the Start parameter and the Subtitle parameter. */
export function ProviderTemplatesGroup({ draft, errors, onChange }: ProviderTemplatesGroupProps) {
  return (
    <Group id="pv-templates" icon={Link} title="Templates">
      {showsTemplates(draft.family) && (
        <ProviderTextRow
          label="Episode template"
          tip={EPISODE_TEMPLATE_TIP}
          value={draft.episodeTemplate}
          error={errors["episodeTemplate"]}
          onChange={(episodeTemplate) => onChange({ episodeTemplate })}
        />
      )}
      <ProviderTextRow
        label="Start parameter"
        tip={START_PARAM_TIP}
        value={draft.startParam}
        error={errors["startParam"]}
        onChange={(startParam) => onChange({ startParam })}
      />
      <ProviderTextRow
        label="Subtitle parameter"
        tip={SUBTITLES_PARAM_TIP}
        value={draft.subtitlesParam}
        error={errors["subtitlesParam"]}
        onChange={(subtitlesParam) => onChange({ subtitlesParam })}
      />
    </Group>
  );
}
