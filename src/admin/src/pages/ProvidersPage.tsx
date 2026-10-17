import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { IndexSkeleton } from "@/components/records/IndexSkeleton";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";

const FRAME = INDEX_FRAMES.providers;

/** Providers. Wave 2 draws its index skeleton; the New form, the grid and the workspace arrive in Wave 4. */
export function ProvidersPage({ active }: PageProps) {
  return (
    <TabPage active={active} label="Providers">
      <IndexToolbar frame={FRAME} />
      <IndexSkeleton frame={FRAME} />
    </TabPage>
  );
}
