import { FileText } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Select } from "@giga/ui/controls/Select";
import { Toggle } from "@giga/ui/controls/Toggle";
import { cn } from "@giga/ui/lib/cn";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { FolderRow } from "@/components/records/FolderRow";
import { VideoList } from "@/components/records/VideoList";
import { LogoImage } from "@/components/ui/LogoImage";
import { CATEGORIES } from "@/constants/channel-copy";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import type { LiveDraft } from "@/lib/channel-draft";
import { logoAddress } from "@/lib/preview-address";
import type { FormErrors } from "@/lib/record-form";
import type { LiveAdminChannel } from "@/types/admin-channel";

const PLAYS = [
  { value: "folder", label: "Folder" },
  { value: "videos", label: "Videos" },
] as const;

export interface LiveDetailsGroupProps {
  readonly channel: LiveAdminChannel;
  readonly draft: LiveDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<LiveDraft>) => void;
  readonly chooseReason: string | undefined;
  readonly onChoose: () => void;
}

/** A live channel's `Details` (`36` section 6): Name, Kind (read-only), Category (one of six), Plays (Folder or
 *  Videos) and the folder or the ordered videos, Enabled, the logo the backend draws and the Id, both read-only. The
 *  heading carries nothing; `Rebuild` is in the Status group. */
export function LiveDetailsGroup(props: LiveDetailsGroupProps) {
  const { channel, draft, errors, onChange, chooseReason, onChoose } = props;
  const field = (key: "name", label: string) => (
    <Input
      value={draft[key]}
      className={FIELD_CONTROL}
      aria-label={label}
      aria-invalid={errors[key] !== undefined}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange({ [key]: event.target.value })}
    />
  );

  return (
    <Group id="lv-details" icon={FileText} title="Details">
      <Row label="Name" error={errors["name"]}>
        {field("name", "Name")}
      </Row>
      <Row label="Kind" tip={CHANNEL_TIPS.kindFixed}>
        <Input value="Live" readOnly className={cn(FIELD_CONTROL, "text-faint")} aria-label="Kind" />
      </Row>
      <Row label="Category" tip={CHANNEL_TIPS.categoryLive} error={errors["category"]}>
        <Select value={draft.category} className={FIELD_CONTROL} aria-label="Category" onChange={(event) => onChange({ category: event.target.value })}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </Row>
      <Row label="Plays" tip={CHANNEL_TIPS.plays}>
        <Segmented options={PLAYS} value={draft.plays} onChange={(plays) => onChange({ plays })} aria-label="Plays" />
      </Row>
      {draft.plays === "folder" ? (
        <FolderRow
          tip={CHANNEL_TIPS.folder}
          value={draft.folder}
          error={errors["folder"]}
          onChange={(folder) => onChange({ folder })}
          chooseReason={chooseReason}
          onChoose={onChoose}
        />
      ) : (
        <Row label="Videos" tip={CHANNEL_TIPS.videos} error={errors["videos"]} align="start">
          <VideoList videos={draft.videos} invalid={errors["videos"] !== undefined} onChange={(videos) => onChange({ videos })} />
        </Row>
      )}
      <Row label="Enabled" tip={CHANNEL_TIPS.enabledLive} error={errors["enabled"]}>
        <Toggle checked={draft.enabled} aria-label="Enabled" onChange={(enabled) => onChange({ enabled })} />
      </Row>
      <Row label="Logo" tip={CHANNEL_TIPS.logo}>
        <LogoImage src={logoAddress(channel)} alt={`${channel.name} logo`} />
      </Row>
      <Row label="Id" tip={CHANNEL_TIPS.id}>
        <Input value={channel.id} readOnly className={cn(FIELD_CONTROL, "font-mono text-faint")} aria-label="Id" />
      </Row>
    </Group>
  );
}
