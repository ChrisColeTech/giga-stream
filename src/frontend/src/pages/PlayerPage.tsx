import { PanePlaceholder } from "@/components/chrome/PanePlaceholder";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";

/** Player: the browser on the left, the tabbed stage in the centre, the inspector on the right, the related band
 *  along the bottom. Always reachable: with nothing open it shows its empty stage. */
export function PlayerPage({ active }: { active: boolean }) {
  return (
    <WorkspaceSplit
      surface="player"
      active={active}
      left={<PanePlaceholder name="Player / browser" />}
      center={<PanePlaceholder name="Player / stage" />}
      right={<PanePlaceholder name="Player / inspector" />}
      bottom={<PanePlaceholder name="Player / related" />}
    />
  );
}
