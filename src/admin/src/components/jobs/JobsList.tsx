import { Timer } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useJobActions } from "@/hooks/useJobActions";
import { useJobView } from "@/hooks/useJobView";
import { LIST_BARS } from "@/constants/list-query-copy";
import { tickState } from "@/lib/list-query";
import { useAppStore } from "@/store/app-store";
import { ListQueryBar } from "@/components/records/ListQueryBar";
import { JobRows } from "./JobRows";

/** `Jobs`: the list group. Its first rows (`01` section 9) are the query row (search, Sort, Type and State) and the
 *  selection toolbar: `Refresh` (it reads the jobs, the playlists and the audit tail: how a catalog run's end is learnt,
 *  since nothing polls; disabled with `Loading.` while a read runs), then the bulk verbs with the armed `Delete` last,
 *  always drawn and disabled with their reason until a row is ticked; the three-state `All` ticks the rows the query
 *  shows. The verbs come from the page's one bulk instance (`useJobBulk`), so the promote's run is seen here. */
export function JobsList({ verbs }: { readonly verbs: readonly StripVerb[] }) {
  const { status, ticked } = useAppStore((state) => state.jobs);
  const setTicked = useAppStore((state) => state.jobsSetTicked);
  const { flows, track } = useJobActions();
  const view = useJobView();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = {
    label: "Select all jobs",
    checked: tickState(view.visible.map((row) => String(row.id)), ticked.map(String)),
    onToggle: (on: boolean) => setTicked(on ? view.visible.map((row) => row.id) : []),
    disabled: view.visible.length === 0,
  };
  const strip = (
    <TableStrip
      label="Jobs table"
      noun="jobs"
      query={<ListQueryBar def={LIST_BARS.jobs} query={view.query} handlers={view.handlers} />}
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs }}
    />
  );
  return (
    <ListGroup id="jb-list" icon={Timer} title="Jobs" strip={strip} all={all} fill>
      <JobRows />
    </ListGroup>
  );
}
