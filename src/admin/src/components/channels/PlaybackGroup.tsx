import { Play } from "lucide-react";
import { ChipGroup } from "@giga/ui/controls/ChipGroup";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Toggle } from "@giga/ui/controls/Toggle";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SaveDetails } from "@/components/records/SaveDetails";
import type { SaveVerb } from "@/lib/workspace-verbs";
import { MIN_VARIANTS, MIN_VARIANTS_REASON, VARIANTS } from "@/constants/channel-copy";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import { toggleVariant, type LiveDraft } from "@/lib/channel-draft";
import type { Variant } from "@/types/admin-channel";

const MODES = [
  { value: "loop", label: "Loop" },
  { value: "encode", label: "Encode" },
] as const;

const QUALITY_OPTIONS = VARIANTS.map((variant) => ({ value: variant, label: variant }));

const isVariant = (value: string): value is Variant => VARIANTS.some((variant) => variant === value);

export interface PlaybackGroupProps {
  readonly draft: LiveDraft;
  readonly onChange: (patch: Partial<LiveDraft>) => void;
  /** The form's one commit, ending this last editable group. */
  readonly save: SaveVerb;
}

/** A live channel's `Playback` (`36` section 6): Mode (Loop or Encode, the cost in the tip), Captions, and the Qualities as
 *  any-of pills that keep at least two: the last two lit cannot be switched off, with the reason as their title. A change
 *  here saves and rebuilds the channel. */
export function PlaybackGroup({ draft, onChange, save }: PlaybackGroupProps) {
  return (
    <Group id="lv-playback" icon={Play} title="Playback">
      <Row label="Mode" tip={CHANNEL_TIPS.mode}>
        <Segmented field options={MODES} value={draft.mode} onChange={(mode) => onChange({ mode })} aria-label="Mode" className="w-full" />
      </Row>
      <Row label="Captions" tip={CHANNEL_TIPS.captions}>
        <Toggle checked={draft.captions} aria-label="Captions" onChange={(captions) => onChange({ captions })} />
      </Row>
      <Row label="Qualities" tip={CHANNEL_TIPS.qualities}>
        <ChipGroup
          field
          options={QUALITY_OPTIONS}
          selected={new Set<string>(draft.variants)}
          min={MIN_VARIANTS}
          minText={MIN_VARIANTS_REASON}
          aria-label="Qualities"
          className="w-full"
          onToggle={(value) => {
            if (isVariant(value)) onChange({ variants: toggleVariant(draft.variants, value) });
          }}
        />
      </Row>
      <SaveDetails save={save} />
    </Group>
  );
}
