import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { IndexSkeleton } from "@/components/records/IndexSkeleton";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";

const FRAME = INDEX_FRAMES.jobs;

/** Jobs. Wave 2 draws its index skeleton; the New form, the grid and the workspace arrive in Wave 5. */
export function JobsPage({ active }: PageProps) {
  return (
    <TabPage active={active} label="Jobs">
      <IndexToolbar frame={FRAME} />
      <IndexSkeleton frame={FRAME} />
    </TabPage>
  );
}
