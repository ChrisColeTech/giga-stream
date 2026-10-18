import { Users } from "lucide-react";
import { Textarea } from "@giga/ui/controls/Textarea";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { CAST_TIP } from "@/constants/title-copy";
import type { FormErrors } from "@/lib/record-form";
import type { TitleDraft } from "@/lib/title-draft";
import { TitleTextRow } from "./TitleTextRow";

export interface TitlePlotGroupProps {
  readonly draft: TitleDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<TitleDraft>) => void;
}

const PLOT_ROWS = 4;

/** `Plot` (`37` section 4.3): the Plot (a `Textarea`) and the Cast (a comma list, sent as `string[]`). */
export function TitlePlotGroup({ draft, errors, onChange }: TitlePlotGroupProps) {
  return (
    <Group id="tw-plot" icon={Users} title="Plot">
      <Row label="Plot" error={errors["plot"]} align="start">
        <Textarea
          rows={PLOT_ROWS}
          value={draft.plot}
          className="w-full min-w-0 flex-1 text-sm!"
          aria-label="Plot"
          aria-invalid={errors["plot"] !== undefined}
          onChange={(event) => onChange({ plot: event.target.value })}
        />
      </Row>
      <TitleTextRow
        label="Cast"
        tip={CAST_TIP}
        value={draft.cast}
        error={errors["cast"]}
        onChange={(cast) => onChange({ cast })}
      />
    </Group>
  );
}
