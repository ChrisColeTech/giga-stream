import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { TitlesIndex } from "@/components/titles/TitlesIndex";
import { TitleWorkspace } from "@/components/titles/TitleWorkspace";
import { useTitlesLoad } from "@/hooks/useTitlesLoad";
import { useAppStore } from "@/store/app-store";

/** Titles: the index (bulk toolbar with `Jobs →`, `New title`, the list with its search, Kind chips, Sort and pager)
 *  or, when a row is open, that title's workspace. The page is the only reader of `workspaces.titles`. It reads the
 *  titles when first shown in a session. */
export function TitlesPage({ active }: PageProps) {
  const openId = useAppStore((state) => state.workspaces.titles);
  useTitlesLoad(active);
  return (
    <TabPage active={active} label="Titles">
      {openId === null ? <TitlesIndex /> : <TitleWorkspace id={openId} active={active} />}
    </TabPage>
  );
}
