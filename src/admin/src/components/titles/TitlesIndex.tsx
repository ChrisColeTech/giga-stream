import { Workspace } from "@giga/ui/form/Workspace";
import { TITLES_INDEX_LABELS } from "@/constants/title-copy";
import { DeletedTitlesGroup } from "./DeletedTitlesGroup";
import { NewTitleForm } from "./NewTitleForm";
import { TitleListGroup } from "./TitleListGroup";
import { TitlesToolbar } from "./TitlesToolbar";

/** The Titles index: the bulk toolbar with `Jobs →` over `New title` and the list (search, chips, sort, pager), then
 *  `Deleted titles` (`37` section 4.4). */
export function TitlesIndex() {
  return (
    <>
      <TitlesToolbar />
      <Workspace labels={TITLES_INDEX_LABELS}>
        <NewTitleForm />
        <TitleListGroup />
        <DeletedTitlesGroup />
      </Workspace>
    </>
  );
}
