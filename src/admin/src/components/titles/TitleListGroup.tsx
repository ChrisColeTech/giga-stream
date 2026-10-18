import { Clapperboard } from "lucide-react";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Wide } from "@giga/ui/form/Wide";
import { VIEW_LABEL, VIEW_OPTIONS, VIEW_TIP } from "@/constants/title-stored-copy";
import { storedBadge } from "@/lib/title-stored-badge";
import { useAppStore } from "@/store/app-store";
import { TitleBrowseList } from "./TitleBrowseList";
import { TitleStoredList } from "./TitleStoredList";

/** `Titles` (`37` section 4.2, `docs/41` section 5.2): the list group. A labelled `View` row (`Stored` | `Browse TMDB`,
 *  `Stored` first, the page's main list) sits above the list, which is one of two lists, each with its own state: the
 *  stored titles (paged by offset, windowed above 100 rows) or the TMDB browse page. The heading carries the count of
 *  stored titles as its badge and nothing else; `Jobs →` is the page toolbar's. */
export function TitleListGroup() {
  const mode = useAppStore((state) => state.titlesStored.mode);
  const inventory = useAppStore((state) => state.titlesStored.paged.inventory);
  const setMode = useAppStore((state) => state.storedSetMode);
  const badge = mode === "stored" ? storedBadge(inventory) : undefined;
  return (
    <Group id="ti-list" icon={Clapperboard} title="Titles" badge={badge} last={false}>
      <Row label={VIEW_LABEL} tip={VIEW_TIP}>
        <Segmented aria-label={VIEW_LABEL} options={VIEW_OPTIONS} value={mode} onChange={setMode} />
      </Row>
      <Wide>
        <div className="flex flex-col gap-3">{mode === "stored" ? <TitleStoredList /> : <TitleBrowseList />}</div>
      </Wide>
    </Group>
  );
}
