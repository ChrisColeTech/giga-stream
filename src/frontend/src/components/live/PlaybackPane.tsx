import { Select } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/NumberField";
import { EMPTY_VALUE, PICTURE_FIT_LABEL, PLAYBACK_SECTION_TITLES, REASON_NEEDS_PLAYING } from "@/lib/live-constants";
import { PICTURE_FIT_OPTIONS, type PictureFit } from "@/lib/live-picture";

/* A rail's one-of choice is a Select, never chips: LoRA Studio's compose rail (components/generate/ComposeRail.tsx,
   "Selects, not segmented tracks") - chips cannot share a rail's width. */
const choiceOfFit = (value: string): PictureFit =>
  PICTURE_FIT_OPTIONS.find((option) => option.value === value)?.value ?? "fit";
import { PlaybackRow } from "./PlaybackRow";
import { PlaybackSection } from "./PlaybackSection";

export interface PlaybackPaneProps {
  readonly fit: PictureFit;
  readonly onFitChange: (fit: PictureFit) => void;
}

/** A select that needs a playing stream: one option, disabled, the reason as its tooltip. */
function IdleSelect({ label, value, text }: { readonly label: string; readonly value: string; readonly text: string }) {
  return (
    <Select aria-label={label} value={value} disabled title={REASON_NEEDS_PLAYING} className={FIELD_CONTROL}>
      <option value={value}>{text}</option>
    </Select>
  );
}

/** The five playback groups (`06` section 3.3). Every row that needs a playing stream is disabled in place with the
 *  reason as its tooltip; Fit, Fill and Original always work. */
export function PlaybackPane({ fit, onFitChange }: PlaybackPaneProps) {
  /* A readout is a value with no control, in the rail's mono, one control height tall. */
  const unplayed = <span className="flex h-ctl-sm items-center font-mono text-xs text-muted">{EMPTY_VALUE}</span>;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PlaybackSection id="live.playback.video" title={PLAYBACK_SECTION_TITLES.video}>
        <PlaybackRow label="Quality" reason={REASON_NEEDS_PLAYING}>
          <IdleSelect label="Quality" value="auto" text="Auto" />
        </PlaybackRow>
        <PlaybackRow label="Resolution" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
        <PlaybackRow label="Bitrate" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.display" title={PLAYBACK_SECTION_TITLES.display}>
        <PlaybackRow label="Fit">
          <Select
            aria-label={PICTURE_FIT_LABEL}
            className={FIELD_CONTROL}
            value={fit}
            onChange={(event) => onFitChange(choiceOfFit(event.target.value))}
          >
            {PICTURE_FIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </PlaybackRow>
        <PlaybackRow label="Aspect" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.audio" title={PLAYBACK_SECTION_TITLES.audio}>
        <PlaybackRow label="Track" reason={REASON_NEEDS_PLAYING}>
          <IdleSelect label="Audio track" value="default" text="Default" />
        </PlaybackRow>
        <PlaybackRow label="Language" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.captions" title={PLAYBACK_SECTION_TITLES.captions}>
        <PlaybackRow label="Captions" reason={REASON_NEEDS_PLAYING}>
          <IdleSelect label="Captions" value="off" text="Off" />
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.playback" title={PLAYBACK_SECTION_TITLES.playback}>
        <PlaybackRow label="Latency" reason={REASON_NEEDS_PLAYING}>
          <IdleSelect label="Latency" value="normal" text="Normal" />
        </PlaybackRow>
        <PlaybackRow label="Live edge" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
      </PlaybackSection>
    </div>
  );
}
