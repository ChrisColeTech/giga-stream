import { ToolbarStrip } from "@giga/ui/shell/ToolbarStrip";
import { BulkNotes } from "@/components/records/BulkNotes";
import { useJobBulk } from "@/hooks/useJobBulk";

/** The Jobs toolbar (`38` section 4.2): the ghost `Enable`, `Disable` and armed `Delete N jobs?`, then the one filled
 *  verb, `Run job`, all acting on the ticked jobs and each disabled with its reason. What a run could not do is listed
 *  under the strip. */
export function JobsToolbar() {
  const { verbs, notes, dismiss } = useJobBulk();
  return (
    <>
      <ToolbarStrip label="Jobs toolbar" verbs={verbs} />
      <BulkNotes notes={notes} onDismiss={dismiss} />
    </>
  );
}
