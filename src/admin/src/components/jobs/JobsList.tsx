import { Timer } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useJobActions } from "@/hooks/useJobActions";
import { useJobBulk } from "@/hooks/useJobBulk";
import { selectAll } from "@/lib/playlist-rows";
import { useAppStore } from "@/store/app-store";
import { JobRows } from "./JobRows";

/** `Jobs`: the list group. Its selection toolbar (`01` section 9) holds `Refresh` (it reads the jobs, the playlists and the
 *  audit tail: how a catalog run's end is learnt, since nothing polls; disabled with `Loading.` while a read runs), then
 *  the bulk verbs with the armed `Delete` last, always drawn and disabled with their reason until a row is ticked, and the
 *  three-state `All` on the right. */
export function JobsList() {
  const { status, items, ticked } = useAppStore((state) => state.jobs);
  const tickAll = useAppStore((state) => state.jobsTickAll);
  const { flows, track } = useJobActions();
  const { verbs } = useJobBulk();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = {
    label: "Select all jobs",
    checked: selectAll(items, ticked),
    onToggle: tickAll,
    disabled: items.length === 0,
  };
  const strip = (
    <TableStrip
      label="Jobs table"
      noun="jobs"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs }}
    />
  );
  return (
    <ListGroup id="jb-list" icon={Timer} title="Jobs" strip={strip} all={all}>
      <JobRows />
    </ListGroup>
  );
}
