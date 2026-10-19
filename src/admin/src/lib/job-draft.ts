import type { AdminJob, CatalogJobConfig } from "@/services/schemas/job-schema";
import { catalogConfigOf } from "./job-rows";

/* The Jobs forms' values (`38` sections 4.2 and 4.3, `43` section 4.1), pure. Every field holds what its control holds
 * (text for a number field), so `dirty` is a fact about values. The New form makes catalog jobs only: a playlist's job
 * is made with the playlist. A discover or recent job walks both kinds, so its kind is never sent. */

export type JobScope = CatalogJobConfig["scope"];
export type JobKind = NonNullable<CatalogJobConfig["kind"]>;

/** The Library fill (`discover`) and the Library update (`recent`) walk both kinds: no Kind row, no kind sent. */
export const walksBothKinds = (scope: JobScope): boolean => scope === "discover" || scope === "recent";

/** Only Trending and Popular consume a bounded page count. */
export const hasPages = (scope: JobScope): boolean => scope === "trending" || scope === "popular";
export const DEFAULT_JOB_PAGES = "5";

export interface JobDraft {
  readonly name: string;
  readonly enabled: boolean;
  readonly scope: JobScope;
  readonly kind: JobKind;
  /** A catalog job's page count, as typed. */
  readonly pages: string;
  /** The interval, as typed: `6h`, `30m`, `24h`, `off`. */
  readonly schedule: string;
}

export const EMPTY_NEW_JOB: JobDraft = {
  name: "",
  enabled: true,
  scope: "trending",
  kind: "all",
  pages: DEFAULT_JOB_PAGES,
  schedule: "off",
};

export const sameNewJob = (a: JobDraft, b: JobDraft): boolean => sameJobDraft(a, b);

export function draftOf(job: AdminJob): JobDraft {
  const catalog = catalogConfigOf(job);
  return {
    name: job.name,
    enabled: job.enabled,
    scope: catalog?.scope ?? "trending",
    kind: catalog?.kind ?? "movie",
    pages: catalog === null ? "" : String(catalog.pages ?? DEFAULT_JOB_PAGES),
    schedule: job.schedule,
  };
}

export const sameJobDraft = (a: JobDraft, b: JobDraft): boolean =>
  a.name === b.name &&
  a.enabled === b.enabled &&
  a.scope === b.scope &&
  a.kind === b.kind &&
  a.pages === b.pages &&
  a.schedule === b.schedule;
