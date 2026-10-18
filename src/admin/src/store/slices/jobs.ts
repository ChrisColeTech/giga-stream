import type { SliceGet, SliceSet } from "./slice-host";

/** PLACEHOLDER. The Jobs wave replaces this file (it re-exports `store/jobs-slice.ts`); until then the tab has no state
 *  of its own and the registry spreads nothing for it. */
export type JobsSlice = Record<never, never>;

export function createJobsSlice(_set: SliceSet<JobsSlice>, _get: SliceGet<JobsSlice>): JobsSlice {
  return {};
}
