import { Segmented } from "@/components/ui/Segmented";
import { SelectField } from "@/components/ui/SelectField";
import { EMPTY_VALUE, PICTURE_FIT_LABEL, PLAYBACK_SECTION_TITLES, REASON_NEEDS_PLAYING } from "@/lib/live-constants";
import { PICTURE_FIT_OPTIONS, type PictureFit } from "@/lib/live-picture";
import { PlaybackRow } from "./PlaybackRow";
import { PlaybackSection } from "./PlaybackSection";

export interface PlaybackPaneProps {
  readonly fit: PictureFit;
  readonly onFitChange: (fit: PictureFit) => void;
}

const noChange = () => undefined;

/** The five playback groups (`06` section 3.3). Every row that needs a playing stream is disabled in place with the
 *  reason as its tooltip; Fit, Fill and Original always work. */
export function PlaybackPane({ fit, onFitChange }: PlaybackPaneProps) {
  /* A readout is a value with no control: mono 11 px, one control height tall, dim because its row is disabled. */
  const unplayed = (
    <span title={REASON_NEEDS_PLAYING} className="flex h-ctl-md items-center font-mono text-[11px] text-dim">
      {EMPTY_VALUE}
    </span>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlaybackSection id="live.playback.video" title={PLAYBACK_SECTION_TITLES.video}>
        <PlaybackRow label="Quality" reason={REASON_NEEDS_PLAYING}>
          <SelectField
            label="Quality"
            value="auto"
            options={[{ value: "auto", label: "Auto" }]}
            onChange={noChange}
            disabled
            reason={REASON_NEEDS_PLAYING}
          />
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
          <Segmented options={PICTURE_FIT_OPTIONS} value={fit} onChange={onFitChange} aria-label={PICTURE_FIT_LABEL} />
        </PlaybackRow>
        <PlaybackRow label="Aspect" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.audio" title={PLAYBACK_SECTION_TITLES.audio}>
        <PlaybackRow label="Track" reason={REASON_NEEDS_PLAYING}>
          <SelectField
            label="Audio track"
            value="default"
            options={[{ value: "default", label: "Default" }]}
            onChange={noChange}
            disabled
            reason={REASON_NEEDS_PLAYING}
          />
        </PlaybackRow>
        <PlaybackRow label="Language" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.captions" title={PLAYBACK_SECTION_TITLES.captions}>
        <PlaybackRow label="Captions" reason={REASON_NEEDS_PLAYING}>
          <SelectField
            label="Captions"
            value="off"
            options={[{ value: "off", label: "Off" }]}
            onChange={noChange}
            disabled
            reason={REASON_NEEDS_PLAYING}
          />
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.playback" title={PLAYBACK_SECTION_TITLES.playback}>
        <PlaybackRow label="Latency" reason={REASON_NEEDS_PLAYING}>
          <Segmented
            aria-label="Latency"
            value="normal"
            onChange={noChange}
            options={[
              { value: "normal", label: "Normal", disabled: true, disabledReason: REASON_NEEDS_PLAYING },
              { value: "low", label: "Low", disabled: true, disabledReason: REASON_NEEDS_PLAYING },
            ]}
          />
        </PlaybackRow>
        <PlaybackRow label="Live edge" reason={REASON_NEEDS_PLAYING}>
          {unplayed}
        </PlaybackRow>
      </PlaybackSection>
    </div>
  );
}
