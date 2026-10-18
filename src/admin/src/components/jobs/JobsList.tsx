import { Timer } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useJobActions } from "@/hooks/useJobActions";
import { useJobBulk } from "@/hooks/useJobBulk";
import { useAppStore } from "@/store/app-store";
import { JobRows } from "./JobRows";

/** `Jobs`: the list group. Its table strip holds `Refresh` (it reads the jobs, the playlists and the audit tail: how a
 *  catalog run's end is learnt, since nothing polls; disabled with `Loading.` while a read runs) and, once rows are
 *  ticked, the count, `Enable`, `Disable`, the armed `Delete`, `Run job` and `Clear selection`. */
export function JobsList() {
  const loading = useAppStore((state) => state.jobs.status === "loading");
  const ticked = useAppStore((state) => state.jobs.ticked);
  const setTicked = useAppStore((state) => state.jobsSetTicked);
  const { flows, track } = useJobActions();
  const { verbs } = useJobBulk();
  const strip = (
    <TableStrip
      label="Jobs table"
      noun="jobs"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason: loading ? LOADING_REASON : undefined }}
      selection={{ count: ticked.length, verbs, onClear: () => setTicked([]) }}
    />
  );
  return (
    <ListGroup id="jb-list" icon={Timer} title="Jobs" strip={strip}>
      <JobRows />
    </ListGroup>
  );
}
