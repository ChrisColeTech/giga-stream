import { RefreshCw, Timer } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useJobActions } from "@/hooks/useJobActions";
import { useAppStore } from "@/store/app-store";
import { JobRows } from "./JobRows";

/** `Jobs`: the list group with a ghost `Refresh` in the heading, which reads the jobs (how a catalog run's end is
 *  learnt: nothing polls), the playlists and the audit tail. It is disabled with `Loading.` while a read runs. */
export function JobsList() {
  const loading = useAppStore((state) => state.jobs.status === "loading");
  const { flows, track } = useJobActions();
  const refresh = (
    <Button
      variant="ghost"
      size="sm"
      reason={loading ? LOADING_REASON : undefined}
      onClick={() => void track("refresh", flows.refresh)}
    >
      <RefreshCw aria-hidden /> Refresh
    </Button>
  );
  return (
    <ListGroup id="jb-list" icon={Timer} title="Jobs" action={refresh}>
      <JobRows />
    </ListGroup>
  );
}
