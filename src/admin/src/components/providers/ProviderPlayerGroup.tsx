import { MonitorPlay } from "lucide-react";
import { ChipsInput } from "@giga/ui/controls/ChipsInput";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import {
  FRAME_ORIGIN_SHAPE,
  FRAME_ORIGINS_MAX_REFUSAL,
  FRAME_ORIGINS_TIP,
  MESSAGE_SHAPE_OPTIONS,
  MESSAGE_SHAPE_TIP,
  ORIGIN_TIP,
} from "@/constants/provider-copy";
import { FRAME_ORIGIN_PATTERN, FRAME_ORIGINS_MAX } from "@/lib/provider-checks";
import type { ProviderDraft } from "@/lib/provider-draft";
import type { FormErrors } from "@/lib/record-form";
import { ProviderTextRow } from "./ProviderTextRow";

export interface ProviderPlayerGroupProps {
  readonly draft: ProviderDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<ProviderDraft>) => void;
  /** A value the row refuses in place (a ninth frame origin): the sentence goes under the row. */
  readonly onRefuse: (field: "frameOrigins", sentence: string) => void;
}

/** The chips box takes the form's field height (`37` 3.3); `!` because the track's own min-height shares a layer. */
const CHIPS_FIELD = "min-h-9!";

const isShape = (value: string): value is ProviderDraft["messageShape"] =>
  MESSAGE_SHAPE_OPTIONS.some((option) => option.value === value);

/** `Player` (`37` section 3.3): Origin, Frame origins (chips: Enter or a comma adds, a chip's X removes, a malformed
 *  origin is refused inline by the chips and a ninth under the row) and Message shape (None, `vidsrc-status`,
 *  `player-event`). */
export function ProviderPlayerGroup({ draft, errors, onChange, onRefuse }: ProviderPlayerGroupProps) {
  const frames = (tokens: string[]): void => {
    if (tokens.length > FRAME_ORIGINS_MAX) onRefuse("frameOrigins", FRAME_ORIGINS_MAX_REFUSAL);
    else onChange({ frameOrigins: tokens });
  };
  return (
    <Group id="pv-player" icon={MonitorPlay} title="Player" last>
      <ProviderTextRow
        label="Origin"
        tip={ORIGIN_TIP}
        value={draft.origin}
        error={errors["origin"]}
        onChange={(origin) => onChange({ origin })}
      />
      <Row label="Frame origins" tip={FRAME_ORIGINS_TIP} error={errors["frameOrigins"]}>
        <div className="min-w-0 flex-1">
          <ChipsInput
            value={[...draft.frameOrigins]}
            onChange={frames}
            ariaLabel="Frame origins"
            pattern={FRAME_ORIGIN_PATTERN}
            invalidText={FRAME_ORIGIN_SHAPE}
            className={CHIPS_FIELD}
          />
        </div>
      </Row>
      <Row label="Message shape" tip={MESSAGE_SHAPE_TIP} error={errors["messageShape"]}>
        <Select
          value={draft.messageShape}
          className={FIELD_CONTROL}
          aria-label="Message shape"
          onChange={(event) => {
            const value = event.target.value;
            if (isShape(value)) onChange({ messageShape: value });
          }}
        >
          {MESSAGE_SHAPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Row>
    </Group>
  );
}
