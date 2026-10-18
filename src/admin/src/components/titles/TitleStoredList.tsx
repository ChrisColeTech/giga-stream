import { loadedState, matchingOffer } from "@giga/ui/lib/list-selection";
import { SelectAllScope } from "@giga/ui/lists/SelectAllScope";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { LOADING_REASON } from "@/constants/title-copy";
import { SELECT_ALL_TITLES, selectAllMatching } from "@/constants/title-stored-copy";
import { useTitleActions } from "@/hooks/useTitleActions";
import { useTitleStoredBulk } from "@/hooks/useTitleStoredBulk";
import { useTitleSync } from "@/hooks/useTitleSync";
import { loadedRows } from "@/lib/title-paged";
import { useAppStore } from "@/store/app-store";
import { TitleStoredRows } from "./TitleStoredRows";
import { TitleStoredToolbar } from "./TitleStoredToolbar";

/** The `Stored` view of the list (`docs/41` section 5.2), in the family's order: the list's first row (search, sort,
 *  filters), then the selection toolbar (`Refresh`, `Sync now`, a hairline, `Enable`, `Disable`, `Revert to TMDB` and the
 *  armed `Delete`; on the right `Select all N matching` when it stands and the three-state `All` over the rows loaded),
 *  then the windowed grid. The ticks are ids: they survive scrolling to another page. */
export function TitleStoredList() {
  const { query, typed, paged, selection, status } = useAppStore((state) => state.titlesStored);
  const tickLoaded = useAppStore((state) => state.storedTickLoaded);
  const selectMatching = useAppStore((state) => state.storedSelectAllMatching);
  const { flows, track } = useTitleActions();
  const verbs = useTitleStoredBulk();
  const sync = useTitleSync();
  const ids = loadedRows(paged).map((row) => row.id);
  const offer = matchingOffer(selection, ids, paged.total ?? 0);
  const read = (call: () => Promise<unknown>): void => void track("read", call);

  const all = {
    label: SELECT_ALL_TITLES,
    checked: loadedState(selection, ids),
    onToggle: tickLoaded,
    disabled: ids.length === 0,
  };

  return (
    <SelectAllScope all={all}>
      <TableStrip
        label="Titles table"
        noun="titles"
        query={
          <TitleStoredToolbar
            query={query}
            typed={typed}
            onType={flows.typeStored}
            onSearch={() => read(flows.searchStored)}
            onChange={(change) => read(() => flows.changeStored(change))}
          />
        }
        refresh={{ onPress: () => read(flows.refresh), reason: status === "loading" ? LOADING_REASON : undefined }}
        listVerbs={[sync]}
        selection={{
          verbs,
          ...(offer !== null && { matching: { label: selectAllMatching(offer), onPress: selectMatching } }),
        }}
      />
      <TitleStoredRows />
    </SelectAllScope>
  );
}
