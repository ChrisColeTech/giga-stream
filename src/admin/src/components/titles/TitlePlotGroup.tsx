import { Users } from "lucide-react";
import { Textarea } from "@giga/ui/controls/Textarea";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { CAST_TIP, PLOT_TIP } from "@/constants/title-copy";
import type { FormErrors } from "@/lib/record-form";
import type { TitleDraft } from "@/lib/title-draft";

export interface TitlePlotGroupProps {
  readonly draft: TitleDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<TitleDraft>) => void;
}

const PLOT_ROWS = 4;
const CAST_ROWS = 3;

/** `Plot` (`37` section 4.3, `53` section 2.2): the Plot and the Cast, both text areas — the Cast's names one per
 *  line or comma-separated, still a text draft split into `string[]` by `commaItems`. */
export function TitlePlotGroup({ draft, errors, onChange }: TitlePlotGroupProps) {
  return (
    <Group id="tw-plot" icon={Users} title="Plot">
      <Row label="Plot" tip={PLOT_TIP} error={errors["plot"]} align="start">
        <Textarea
          rows={PLOT_ROWS}
          value={draft.plot}
          className="w-full min-w-0 flex-1 text-sm!"
          aria-label="Plot"
          aria-invalid={errors["plot"] !== undefined}
          onChange={(event) => onChange({ plot: event.target.value })}
        />
      </Row>
      <Row label="Cast" tip={CAST_TIP} error={errors["cast"]} align="start">
        <Textarea
          rows={CAST_ROWS}
          value={draft.cast}
          className="w-full min-w-0 flex-1 text-sm!"
          aria-label="Cast"
          aria-invalid={errors["cast"] !== undefined}
          onChange={(event) => onChange({ cast: event.target.value })}
        />
      </Row>
    </Group>
  );
}
