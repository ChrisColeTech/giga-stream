import { Play } from "lucide-react";
import { Select } from "@/components/ui/Field";
import { FIELD_CONTROL, Group, Row, Workspace } from "@/components/ui/Form";
import { Toggle } from "@/components/ui/Toggle";
import { SUBTITLE_LANGUAGES } from "@/constants/settings-sections";
import { languageOption, languageTag } from "@/lib/settings-language";

const LABELS = ["Autoplay", "Subtitle language"] as const;

export interface PlaybackSectionProps {
  readonly autoplay: boolean;
  readonly onAutoplay: (on: boolean) => void;
  readonly subtitleLanguage: string | null;
  readonly onSubtitleLanguage: (tag: string | null) => void;
}

/** Playback: Autoplay and the subtitle language. Both are local to the window in phase 1 (`21` section 5.5). */
export function PlaybackSection({ autoplay, onAutoplay, subtitleLanguage, onSubtitleLanguage }: PlaybackSectionProps) {
  return (
    <Workspace labels={LABELS}>
      <Group id="settings.playback" title="Playback" icon={Play} last>
        <Row label="Autoplay" tip="Start the next episode when one ends.">
          <Toggle checked={autoplay} aria-label="Autoplay" onChange={onAutoplay} />
        </Row>
        <Row label="Subtitle language" tip="The caption language chosen when a stream offers several.">
          <Select
            aria-label="Subtitle language"
            className={FIELD_CONTROL}
            value={languageOption(subtitleLanguage)}
            onChange={(event) => onSubtitleLanguage(languageTag(event.target.value))}
          >
            {SUBTITLE_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </Select>
        </Row>
      </Group>
    </Workspace>
  );
}
