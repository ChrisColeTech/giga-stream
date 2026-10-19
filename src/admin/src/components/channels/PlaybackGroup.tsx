import { Play } from "lucide-react";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Toggle } from "@giga/ui/controls/Toggle";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import type { LiveDraft } from "@/lib/channel-draft";
import { QualityChecklist } from "./QualityChecklist";

const MODES = [
  { value: "loop", label: "Loop" },
  { value: "encode", label: "Encode" },
] as const;

export interface PlaybackGroupProps {
  readonly draft: LiveDraft;
  readonly onChange: (patch: Partial<LiveDraft>) => void;
}

/** A live channel's `Playback` (`36` section 6): Mode (Loop or Encode, the cost in the tip), Captions, and the Qualities as
 *  any-of pills that keep at least two: the last two lit cannot be switched off, with the reason as their title. A change
 *  here saves and rebuilds the channel. */
export function PlaybackGroup({ draft, onChange }: PlaybackGroupProps) {
  return (
    <Group id="lv-playback" icon={Play} title="Playback">
      <Row label="Mode" tip={CHANNEL_TIPS.mode}>
        <Segmented options={MODES} value={draft.mode} onChange={(mode) => onChange({ mode })} aria-label="Mode" />
      </Row>
      <Row label="Captions" tip={CHANNEL_TIPS.captions}>
        <Toggle checked={draft.captions} aria-label="Captions" onChange={(captions) => onChange({ captions })} />
      </Row>
      <Row label="Qualities" tip={CHANNEL_TIPS.qualities}>
        <QualityChecklist value={draft.variants} onChange={(variants) => onChange({ variants })} />
      </Row>
    </Group>
  );
}
