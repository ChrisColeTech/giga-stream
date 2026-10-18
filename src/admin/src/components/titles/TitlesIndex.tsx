import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { TITLES_INDEX_LABELS } from "@/constants/title-copy";
import { DeletedTitlesGroup } from "./DeletedTitlesGroup";
import { NewTitleForm } from "./NewTitleForm";
import { TitleListGroup } from "./TitleListGroup";

/** The Titles index: the toolbar with the `Jobs` arrow over `New title` and the list (search, chips, sort, then the
 *  table strip and the grid), then `Deleted titles` (`37` section 4.4). */
export function TitlesIndex() {
  return (
    <>
      <IndexToolbar frame={INDEX_FRAMES.titles} />
      <Workspace labels={TITLES_INDEX_LABELS}>
        <NewTitleForm />
        <TitleListGroup />
        <DeletedTitlesGroup />
      </Workspace>
    </>
  );
}
