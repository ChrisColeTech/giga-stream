import { Play } from "lucide-react";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { SelectField } from "@/components/ui/SelectField";
import { Switch } from "@/components/ui/Switch";
import { SUBTITLE_LANGUAGES } from "@/constants/settings-sections";
import { languageOption, languageTag } from "@/lib/settings-language";

export interface PlaybackSectionProps {
  readonly autoplay: boolean;
  readonly onAutoplay: (on: boolean) => void;
  readonly subtitleLanguage: string | null;
  readonly onSubtitleLanguage: (tag: string | null) => void;
}

/** Playback: Autoplay and the subtitle language. Both are local to the window in phase 1 (`21` section 5.5). */
export function PlaybackSection({ autoplay, onAutoplay, subtitleLanguage, onSubtitleLanguage }: PlaybackSectionProps) {
  return (
    <Group id="settings.playback" title="Playback" icon={Play} last>
      <Row label="Autoplay" tip="Start the next episode when one ends.">
        <Switch label="Autoplay" checked={autoplay} onChange={onAutoplay} />
      </Row>
      <Row label="Subtitle language" tip="The caption language chosen when a stream offers several.">
        <SelectField
          label="Subtitle language"
          value={languageOption(subtitleLanguage)}
          options={SUBTITLE_LANGUAGES}
          onChange={(value) => onSubtitleLanguage(languageTag(value))}
          className="max-w-60"
        />
      </Row>
    </Group>
  );
}
