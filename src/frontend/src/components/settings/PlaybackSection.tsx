import { Play } from "lucide-react";
import { Group, Row, Workspace } from "@/components/ui/Form";
import { Toggle } from "@/components/ui/Toggle";
import { useAppStore } from "@/store/app-store";

const LABELS = ["Autoplay"] as const;

/** Playback: Autoplay. The stream preferences (quality, fit, audio and caption languages, latency) have one home, Live's
 *  playback rail (`06` sections 3.3 and 6.2); all of them are the store's playback preferences. */
export function PlaybackSection() {
  const autoplay = useAppStore((state) => state.playback.autoplay);
  const setPlayback = useAppStore((state) => state.setPlayback);
  return (
    <Workspace labels={LABELS}>
      <Group id="settings.playback" title="Playback" icon={Play} last>
        <Row label="Autoplay" tip="Start the next episode when one ends.">
          <Toggle checked={autoplay} aria-label="Autoplay" onChange={(on) => setPlayback({ autoplay: on })} />
        </Row>
      </Group>
    </Workspace>
  );
}
