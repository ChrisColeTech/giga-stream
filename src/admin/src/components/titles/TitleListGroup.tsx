import { Clapperboard } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/title-copy";
import { useForwardVerbs } from "@/hooks/useForwardVerbs";
import { useTitleActions } from "@/hooks/useTitleActions";
import { useTitleBulk } from "@/hooks/useTitleBulk";
import { pagingReasons } from "@/lib/title-query";
import { titleSelectAll } from "@/lib/title-rows";
import { useAppStore } from "@/store/app-store";
import { TitleFilters } from "./TitleFilters";
import { TitleRows } from "./TitleRows";

/** `Titles` (`37` section 4.2): the list group. Its body holds the search, the Kind chips and the Sort pills, then the
 *  selection toolbar (`01` section 9: `Refresh`, then `Enable`, `Disable`, `Revert to TMDB` and the armed `Delete`, always
 *  drawn; on the right the three-state `All`, the `Newer` and `Older` icons and `Jobs →`) directly above the grid. `Newer` is disabled at page 1 with `This
 *  is the first page.`, `Older` at the last page with `This is the last page.`. Every read goes through the flows,
 *  which drop a late answer for a view that is no longer shown. The heading carries nothing. */
export function TitleListGroup() {
  const view = useAppStore((state) => state.titles.view);
  const totalPages = useAppStore((state) => state.titles.totalPages);
  const loading = useAppStore((state) => state.titles.status === "loading");
  const items = useAppStore((state) => state.titles.items);
  const ticked = useAppStore((state) => state.titles.ticked);
  const tickAll = useAppStore((state) => state.titlesTickAll);
  const { flows, track } = useTitleActions();
  const { verbs } = useTitleBulk();
  const forward = useForwardVerbs("titles");
  const paging = pagingReasons(view.page, totalPages);
  const read = (call: () => Promise<unknown>): void => void track("read", call);
  const all = { label: "Select all titles", checked: titleSelectAll(items, ticked), onToggle: tickAll };

  const strip = (
    <TableStrip
      label="Titles table"
      noun="titles"
      forward={forward}
      refresh={{ onPress: () => read(flows.refresh), reason: loading ? LOADING_REASON : undefined }}
      paging={{
        newer: { onPress: () => read(flows.newer), reason: paging.newer },
        older: { onPress: () => read(flows.older), reason: paging.older },
      }}
      selection={{ verbs, all: { ...all, disabled: items.length === 0 } }}
    />
  );

  return (
    <ListGroup id="ti-list" icon={Clapperboard} title="Titles" last={false}>
      <div className="flex flex-col gap-3">
        <TitleFilters
          view={view}
          onType={flows.type}
          onSearch={() => read(flows.search)}
          onKind={(kind) => read(() => flows.toggleKind(kind))}
          onSort={(sort) => read(() => flows.sort(sort))}
        />
        {strip}
        <TitleRows />
      </div>
    </ListGroup>
  );
}
