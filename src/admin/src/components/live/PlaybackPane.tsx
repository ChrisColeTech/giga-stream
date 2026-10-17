import { Select } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/NumberField";
import { EMPTY_VALUE, PICTURE_FIT_LABEL, PLAYBACK_SECTION_TITLES, REASON_NEEDS_PLAYING } from "@/lib/live-constants";
import { PICTURE_FIT_OPTIONS, type PictureFit } from "@/lib/live-picture";
import {
  AUDIO_CHOICES,
  CAPTION_CHOICES,
  LATENCY_CHOICES,
  QUALITY_CHOICES,
  audioOption,
  audioTag,
  latencyOption,
  qualityOf,
  type Choice,
} from "@/lib/playback-prefs";
import { languageOption, languageTag } from "@/lib/settings-language";
import { useAppStore } from "@/store/app-store";
import { PlaybackRow } from "./PlaybackRow";
import { PlaybackSection } from "./PlaybackSection";

/** A preference select: a rail Select (LoRA Studio's compose rail puts a one-of choice in a Select, never chips). */
function PrefSelect({
  label,
  value,
  choices,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly choices: readonly Choice<string>[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <Select aria-label={label} className={FIELD_CONTROL} value={value} onChange={(event) => onChange(event.target.value)}>
      {choices.map((choice) => (
        <option key={choice.value} value={choice.value}>
          {choice.label}
        </option>
      ))}
    </Select>
  );
}

/* A readout is a fact of the stream on screen, in the rail's mono: a dash until a channel plays. It is not a control,
   so it is never dimmed; the tooltip says when it fills in. */
const readout = (
  <span title={REASON_NEEDS_PLAYING} className="flex h-ctl-sm items-center font-mono text-xs text-muted">
    {EMPTY_VALUE}
  </span>
);

const fitOf = (value: string): PictureFit => PICTURE_FIT_OPTIONS.find((option) => option.value === value)?.value ?? "fit";

/** The playback settings (`06` section 3.3): standing preferences that apply to whatever plays, always usable, the way a
 *  video app's settings work, beside the readouts that describe the stream on screen. */
export function PlaybackPane() {
  const playback = useAppStore((state) => state.playback);
  const setPlayback = useAppStore((state) => state.setPlayback);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PlaybackSection id="live.playback.video" title={PLAYBACK_SECTION_TITLES.video}>
        <PlaybackRow label="Quality">
          <PrefSelect
            label="Quality"
            value={playback.videoQuality}
            choices={QUALITY_CHOICES}
            onChange={(value) => setPlayback({ videoQuality: qualityOf(value) })}
          />
        </PlaybackRow>
        <PlaybackRow label="Resolution">{readout}</PlaybackRow>
        <PlaybackRow label="Bitrate">{readout}</PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.display" title={PLAYBACK_SECTION_TITLES.display}>
        <PlaybackRow label="Fit">
          <PrefSelect
            label={PICTURE_FIT_LABEL}
            value={playback.pictureFit}
            choices={PICTURE_FIT_OPTIONS}
            onChange={(value) => setPlayback({ pictureFit: fitOf(value) })}
          />
        </PlaybackRow>
        <PlaybackRow label="Aspect">{readout}</PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.audio" title={PLAYBACK_SECTION_TITLES.audio}>
        <PlaybackRow label="Language">
          <PrefSelect
            label="Audio language"
            value={audioOption(playback.audioLanguage)}
            choices={AUDIO_CHOICES}
            onChange={(value) => setPlayback({ audioLanguage: audioTag(value) })}
          />
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.captions" title={PLAYBACK_SECTION_TITLES.captions}>
        <PlaybackRow label="Captions">
          <PrefSelect
            label="Captions"
            value={languageOption(playback.subtitleLanguage)}
            choices={CAPTION_CHOICES}
            onChange={(value) => setPlayback({ subtitleLanguage: languageTag(value) })}
          />
        </PlaybackRow>
      </PlaybackSection>

      <PlaybackSection id="live.playback.playback" title={PLAYBACK_SECTION_TITLES.playback}>
        <PlaybackRow label="Latency">
          <PrefSelect
            label="Latency"
            value={latencyOption(playback.lowLatency)}
            choices={LATENCY_CHOICES}
            onChange={(value) => setPlayback({ lowLatency: value === "low" })}
          />
        </PlaybackRow>
        <PlaybackRow label="Live edge">{readout}</PlaybackRow>
      </PlaybackSection>
    </div>
  );
}
