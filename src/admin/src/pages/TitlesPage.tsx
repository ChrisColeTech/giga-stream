import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { IndexSkeleton } from "@/components/records/IndexSkeleton";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";

const FRAME = INDEX_FRAMES.titles;

/** Titles. Wave 2 draws its index skeleton; the New form, the list with its search and the workspace arrive in Wave 4. */
export function TitlesPage({ active }: PageProps) {
  return (
    <TabPage active={active} label="Titles">
      <IndexToolbar frame={FRAME} />
      <IndexSkeleton frame={FRAME} />
    </TabPage>
  );
}
