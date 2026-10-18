import { FileText, Undo2 } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Toggle } from "@giga/ui/controls/Toggle";
import { cn } from "@giga/ui/lib/cn";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import type { StreamDraft } from "@/lib/channel-draft";
import type { FormErrors } from "@/lib/record-form";
import type { StreamAdminChannel } from "@/types/admin-channel";
import { EditedTag } from "./EditedTag";

export interface StreamDetailsGroupProps {
  readonly channel: StreamAdminChannel;
  readonly draft: StreamDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<StreamDraft>) => void;
  /** `Revert to playlist`'s reason (a hand-made row, nothing edited), or undefined. */
  readonly revertReason: string | undefined;
  readonly onRevert: () => void;
}

const FIELDS = [
  { key: "name", label: "Name", tip: undefined },
  { key: "category", label: "Category", tip: CHANNEL_TIPS.categoryStream },
] as const;

/** A stream channel's `Details` (`36` section 7): Name, Kind (read-only), Category (free text), Enabled. A field an
 *  admin changed on a synced row wears `Edited` after it, and its tip says the next sync keeps it. The heading's action
 *  slot is `Revert to playlist`, one press, which drops those edits. */
export function StreamDetailsGroup({ channel, draft, errors, onChange, revertReason, onRevert }: StreamDetailsGroupProps) {
  const edited = new Set(channel.editedFields ?? []);
  const tipOf = (key: string, tip: string | undefined): string | undefined =>
    edited.has(key) ? [tip, CHANNEL_TIPS.edited].filter((part) => part !== undefined).join(" ") : tip;
  const revert = (
    <Button variant="ghost" size="sm" reason={revertReason} onClick={onRevert}>
      <Undo2 aria-hidden /> Revert to playlist
    </Button>
  );

  return (
    <Group id="st-details" icon={FileText} title="Details" action={revert}>
      {FIELDS.map((field, index) => (
        <div key={field.key} className="contents">
          <Row
            label={field.label}
            tip={tipOf(field.key, field.tip)}
            error={errors[field.key]}
            trailing={edited.has(field.key) ? <EditedTag /> : undefined}
          >
            <Input
              value={draft[field.key]}
              className={FIELD_CONTROL}
              aria-label={field.label}
              aria-invalid={errors[field.key] !== undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ [field.key]: event.target.value })}
            />
          </Row>
          {index === 0 && (
            <Row label="Kind" tip={CHANNEL_TIPS.kindFixed}>
              <Input value="Stream" readOnly className={cn(FIELD_CONTROL, "text-faint")} aria-label="Kind" />
            </Row>
          )}
        </div>
      ))}
      <Row label="Enabled" tip={CHANNEL_TIPS.enabledStream} error={errors["enabled"]}>
        <Toggle checked={draft.enabled} aria-label="Enabled" onChange={(enabled) => onChange({ enabled })} />
      </Row>
    </Group>
  );
}
