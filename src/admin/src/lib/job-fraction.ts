import type { JobProgress } from "@/services/schemas/job-event-schema";

/* How far a running job is, 0 to 1, from its latest progress (`44` section 3.1). The admin's own copy of the backend's
 * fixed phase weights (the programs never import each other): a playlist run reads (0), fills logos (0 to 20%) and checks
 * streams (20 to 100%); the Library fill walks movies then series (0 to 10%, a half each) and fetches `details` (10 to
 * 100%; a series' episodes ride its detail calls, so there is no episodes phase); any other phase (`list`, one catalog
 * scope) fills the whole bar. Before a phase's total is known it reads its lower bound. Pure. */
export const LOGOS_SHARE = 0.2;
export const WALK_SHARE = 0.1;

type Part = Pick<JobProgress, "phase" | "done" | "total">;

const unit = ({ done, total }: Part): number => (total > 0 ? Math.min(Math.max(done / total, 0), 1) : 0);

export function fractionOf(progress: Part): number {
  const share = unit(progress);
  switch (progress.phase) {
    case "reading": return 0;
    case "logos": return LOGOS_SHARE * share;
    case "checking": return LOGOS_SHARE + (1 - LOGOS_SHARE) * share;
    case "movies": return (WALK_SHARE / 2) * share;
    case "tv": return WALK_SHARE / 2 + (WALK_SHARE / 2) * share;
    case "details": return WALK_SHARE + (1 - WALK_SHARE) * share;
    default: return share;
  }
}

/** The whole percent of a fraction, rounded down (float noise like 28.999999999999996 reads 29); 100 only at 1. */
export const wholePercent = (fraction: number): number => Math.min(100, Math.floor(fraction * 100 + 1e-9));

/** The whole percent a row word shows for a job's progress. */
export const percentOf = (progress: Part): number => wholePercent(fractionOf(progress));
