import { Radio } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { cn } from "@giga/ui/lib/cn";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import type { StreamDraft } from "@/lib/channel-draft";
import type { FormErrors } from "@/lib/record-form";
import { EditedTag } from "./EditedTag";

const FIELDS = [
  { key: "streamUrl", label: "Stream address", tip: CHANNEL_TIPS.streamAddress },
  { key: "logoUrl", label: "Logo address", tip: CHANNEL_TIPS.logoAddress },
] as const;

export interface StreamAddressGroupProps {
  readonly draft: StreamDraft;
  readonly errors: FormErrors;
  readonly edited: readonly string[];
  readonly onChange: (patch: Partial<StreamDraft>) => void;
}

/** A stream channel's `Stream` group (`36` section 7): the stream address and the logo address, each https, checked on
 *  the page and by the backend; a refused address is the row's error, `aria-invalid`, and the notice says it too. */
export function StreamAddressGroup({ draft, errors, edited, onChange }: StreamAddressGroupProps) {
  return (
    <Group id="st-stream" icon={Radio} title="Stream">
      {FIELDS.map((field) => {
        const changed = edited.includes(field.key);
        return (
          <Row
            key={field.key}
            label={field.label}
            tip={changed ? `${field.tip} ${CHANNEL_TIPS.edited}` : field.tip}
            error={errors[field.key]}
            trailing={changed ? <EditedTag /> : undefined}
          >
            <Input
              value={draft[field.key]}
              className={cn(FIELD_CONTROL, "font-mono")}
              aria-label={field.label}
              aria-invalid={errors[field.key] !== undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ [field.key]: event.target.value })}
            />
          </Row>
        );
      })}
    </Group>
  );
}
