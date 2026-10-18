import { Workspace } from "@giga/ui/form/Workspace";
import { TITLES_INDEX_LABELS } from "@/constants/title-copy";
import { NewTitleForm } from "./NewTitleForm";
import { TitleListGroup } from "./TitleListGroup";
import { TitlesToolbar } from "./TitlesToolbar";

/** The Titles index: the bulk toolbar with `Jobs →` over `New title` and the list (search, chips, sort, pager). */
export function TitlesIndex() {
  return (
    <>
      <TitlesToolbar />
      <Workspace labels={TITLES_INDEX_LABELS}>
        <NewTitleForm />
        <TitleListGroup />
      </Workspace>
    </>
  );
}
