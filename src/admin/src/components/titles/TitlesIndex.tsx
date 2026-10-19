import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { TITLES_INDEX_LABELS } from "@/constants/title-copy";
import { useIndexPreviewPromote } from "@/hooks/useIndexPreviewPromote";
import { DeletedTitlesGroup } from "./DeletedTitlesGroup";
import { NewTitleForm } from "./NewTitleForm";
import { TitleListGroup } from "./TitleListGroup";

/** The Titles index: Preview promotes exactly one previewable ticked title over the two retained list modes. */
export function TitlesIndex() {
  const promote = useIndexPreviewPromote("titles");
  return (
    <>
      <IndexToolbar promote={promote} />
      <Workspace labels={TITLES_INDEX_LABELS} fill>
        <NewTitleForm />
        <TitleListGroup />
        <DeletedTitlesGroup />
      </Workspace>
    </>
  );
}
