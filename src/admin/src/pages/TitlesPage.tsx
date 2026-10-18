import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { TitlesIndex } from "@/components/titles/TitlesIndex";
import { useTitlesLoad } from "@/hooks/useTitlesLoad";

/** Titles: the index (bulk toolbar with `Jobs →`, `New title`, the list with its search, Kind chips, Sort and pager). It
 *  reads the titles when first shown in a session. */
export function TitlesPage({ active }: PageProps) {
  useTitlesLoad(active);
  return (
    <TabPage active={active} label="Titles">
      <TitlesIndex />
    </TabPage>
  );
}
