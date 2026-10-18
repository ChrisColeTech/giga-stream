import { useEffect } from "react";
import type { RecordForm } from "./useRecordForm";

/** Keeps a workspace's form with its record when the held record changes under it (a refresh, a save's answer, a bulk
 *  run): a clean form follows the new record; a form being edited keeps what the person typed, unless it already holds
 *  the saved values. A hook, so the component stays a render of props. */
export function useFollowRecord<R, D extends object>(
  form: RecordForm<D>,
  record: R,
  toDraft: (record: R) => D,
  same: (a: D, b: D) => boolean,
): void {
  useEffect(() => {
    const next = toDraft(record);
    if (!form.dirty || same(form.draft, next)) form.reset(next);
  }, [record]);
}
