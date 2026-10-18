import { Workspace } from "@giga/ui/form/Workspace";
import { TITLES_INDEX_LABELS } from "@/constants/title-copy";
import { DeletedTitlesGroup } from "./DeletedTitlesGroup";
import { NewTitleForm } from "./NewTitleForm";
import { TitleListGroup } from "./TitleListGroup";

/** The Titles index: `New title` and the list (search, chips, sort, then the table strip with its `Go to Jobs` icon and
 *  the grid), then `Deleted titles` (`37` section 4.4). No page toolbar. */
export function TitlesIndex() {
  return (
    <Workspace labels={TITLES_INDEX_LABELS}>
      <NewTitleForm />
      <TitleListGroup />
      <DeletedTitlesGroup />
    </Workspace>
  );
}
