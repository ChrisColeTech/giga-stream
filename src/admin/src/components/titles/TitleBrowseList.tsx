import { TableStrip } from "@giga/ui/lists/TableStrip";
import { LOADING_REASON } from "@/constants/title-copy";
import { useTitleActions } from "@/hooks/useTitleActions";
import { useTitleBulk } from "@/hooks/useTitleBulk";
import { pagingReasons } from "@/lib/title-query";
import { titleSelectAll } from "@/lib/title-rows";
import { useAppStore } from "@/store/app-store";
import { TitleFilters } from "./TitleFilters";
import { TitleRows } from "./TitleRows";

/** The `Browse TMDB` view of the list (`37` section 4.2): the search, the Kind chips and the Sort pills, then the selection
 *  toolbar (`Refresh`, the bulk verbs, the three-state `All` and the `Newer` and `Older` icons; `Newer` is disabled at page 1
 *  with `This is the first page.`, `Older` at the last page with `This is the last page.`) and the grid. Reading a page
 *  stores what it reads, so browsing is how the store grows. */
export function TitleBrowseList() {
  const view = useAppStore((state) => state.titles.view);
  const totalPages = useAppStore((state) => state.titles.totalPages);
  const loading = useAppStore((state) => state.titles.status === "loading");
  const items = useAppStore((state) => state.titles.items);
  const ticked = useAppStore((state) => state.titles.ticked);
  const tickAll = useAppStore((state) => state.titlesTickAll);
  const { flows, track } = useTitleActions();
  const { verbs } = useTitleBulk();
  const paging = pagingReasons(view.page, totalPages);
  const read = (call: () => Promise<unknown>): void => void track("read", call);
  const all = { label: "Select all titles", checked: titleSelectAll(items, ticked), onToggle: tickAll };

  return (
    <>
      <TitleFilters
        view={view}
        onType={flows.type}
        onSearch={() => read(flows.search)}
        onKind={(kind) => read(() => flows.toggleKind(kind))}
        onSort={(sort) => read(() => flows.sort(sort))}
      />
      <TableStrip
        label="Titles table"
        noun="titles"
        refresh={{ onPress: () => read(flows.refresh), reason: loading ? LOADING_REASON : undefined }}
        paging={{
          newer: { onPress: () => read(flows.newer), reason: paging.newer },
          older: { onPress: () => read(flows.older), reason: paging.older },
        }}
        selection={{ verbs, all: { ...all, disabled: items.length === 0 } }}
      />
      <TitleRows />
    </>
  );
}
