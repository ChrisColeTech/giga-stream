import { Clapperboard, RefreshCw } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/title-copy";
import { useTitleActions } from "@/hooks/useTitleActions";
import { pagingReasons } from "@/lib/title-query";
import { useAppStore } from "@/store/app-store";
import { TitleFilters } from "./TitleFilters";
import { TitleRows } from "./TitleRows";

/** `Titles` (`37` section 4.2): the list group. Its heading's action slot holds `Older` and `Newer` (`Newer` disabled
 *  at page 1 with `This is the first page.`, `Older` at the last page with `This is the last page.`) and `Refresh`;
 *  its body the search, the Kind chips, the Sort pills and the grid. Every read goes through the flows, which drop a
 *  late answer for a view that is no longer shown. */
export function TitleListGroup() {
  const view = useAppStore((state) => state.titles.view);
  const totalPages = useAppStore((state) => state.titles.totalPages);
  const loading = useAppStore((state) => state.titles.status === "loading");
  const { flows, track } = useTitleActions();
  const paging = pagingReasons(view.page, totalPages);
  const read = (call: () => Promise<unknown>): void => void track("read", call);

  const action = (
    <>
      <Button variant="ghost" size="sm" reason={paging.older} onClick={() => read(flows.older)}>
        Older
      </Button>
      <Button variant="ghost" size="sm" reason={paging.newer} onClick={() => read(flows.newer)}>
        Newer
      </Button>
      <Button
        variant="ghost"
        size="sm"
        reason={loading ? LOADING_REASON : undefined}
        onClick={() => read(flows.refresh)}
      >
        <RefreshCw aria-hidden /> Refresh
      </Button>
    </>
  );

  return (
    <ListGroup id="ti-list" icon={Clapperboard} title="Titles" action={action}>
      <div className="flex flex-col gap-3">
        <TitleFilters
          view={view}
          onType={flows.type}
          onSearch={() => read(flows.search)}
          onKind={(kind) => read(() => flows.toggleKind(kind))}
          onSort={(sort) => read(() => flows.sort(sort))}
        />
        <TitleRows />
      </div>
    </ListGroup>
  );
}
