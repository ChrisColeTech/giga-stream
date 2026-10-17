import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { IndexSkeleton } from "@/components/records/IndexSkeleton";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";

const FRAME = INDEX_FRAMES.channels;

/** Channels. Wave 2 draws its index skeleton; the New form, the grid and both workspaces arrive in Wave 3. */
export function ChannelsPage({ active }: PageProps) {
  return (
    <TabPage active={active} label="Channels">
      <IndexToolbar frame={FRAME} />
      <IndexSkeleton frame={FRAME} />
    </TabPage>
  );
}
