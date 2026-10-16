import { PanePlaceholder } from "@/components/chrome/PanePlaceholder";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";

/** Live: playback settings on the left, the video stage in the centre, channels on the right. */
export function LivePage({ active }: { active: boolean }) {
  return (
    <WorkspaceSplit
      surface="live"
      active={active}
      left={<PanePlaceholder name="Live / playback settings" />}
      center={<PanePlaceholder name="Live / stage" />}
      right={<PanePlaceholder name="Live / channels" />}
    />
  );
}
