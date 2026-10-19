import { Play, Radio } from "lucide-react";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Toggle } from "@giga/ui/controls/Toggle";
import { SETTINGS_LABELS } from "@/constants/settings-sections";
import { useAppStore } from "@/store/app-store";
import type { PlaybackPrefs } from "@/types/settings";


const RESUME = [
  { value: "ask", label: "Ask" },
  { value: "resume", label: "Always resume" },
  { value: "restart", label: "Always start over" },
] as const satisfies ReadonlyArray<{ value: PlaybackPrefs["resumeMode"]; label: string }>;

const WATCHED: ReadonlyArray<{ value: PlaybackPrefs["watchedPercent"]; label: string }> = [
  { value: 90, label: "At 90%" },
  { value: 95, label: "At 95%" },
  { value: 100, label: "At the end" },
];

const ON_OPEN = [
  { value: "last", label: "Last channel" },
  { value: "none", label: "Nothing" },
] as const satisfies ReadonlyArray<{ value: PlaybackPrefs["liveOnOpen"]; label: string }>;

/** Playback: how titles play (Autoplay, Resume, when a title counts as watched) and how Live starts. The stream
 *  preferences (quality, fit, audio and caption languages, latency) have one home, Live's playback rail (`06` sections 3.3
 *  and 6.2). All of these are the store's playback preferences, applied at once. */
export function PlaybackSection() {
  const playback = useAppStore((state) => state.playback);
  const setPlayback = useAppStore((state) => state.setPlayback);
  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group title="Playback" icon={Play}>
        <Row label="Autoplay" tip="Start the next episode when one ends.">
          <Toggle checked={playback.autoplay} aria-label="Autoplay" onChange={(on) => setPlayback({ autoplay: on })} />
        </Row>
        <Row label="Resume" tip="What happens when you open a title you left partway.">
          <Select
            aria-label="Resume"
            className={FIELD_CONTROL}
            value={playback.resumeMode}
            onChange={(event) => {
              const resumeMode = RESUME.find((option) => option.value === event.target.value)?.value ?? "ask";
              setPlayback({ resumeMode });
            }}
          >
            {RESUME.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Row>
        <Row label="Mark as watched" tip="How far in a title counts as watched, which takes it off Continue watching.">
          <Select
            aria-label="Mark as watched"
            className={FIELD_CONTROL}
            value={String(playback.watchedPercent)}
            onChange={(event) =>
              setPlayback({ watchedPercent: WATCHED.find((option) => String(option.value) === event.target.value)?.value ?? 90 })
            }
          >
            {WATCHED.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        </Row>
      </Group>
      <Group title="Live" icon={Radio} last>
        <Row label="On open" tip="What Live plays when you switch to it.">
          <Segmented
            aria-label="On open"
            options={ON_OPEN}
            value={playback.liveOnOpen}
            onChange={(liveOnOpen) => setPlayback({ liveOnOpen })}
          />
        </Row>
      </Group>
    </Workspace>
  );
}
