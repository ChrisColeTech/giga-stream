import type { AdminJob, CatalogJobConfig } from "@/services/schemas/job-schema";
import { catalogConfigOf, playlistIdOf } from "./job-rows";

/* The Jobs forms' values (`38` sections 4.2 and 4.3), pure. Every field holds what its control holds (text for a select
 * and a number field), so `dirty` is a fact about values. The Run group's `Dry run` and `Prune` are not part of the
 * draft: they are the once-only override of the next run, never saved. */

export type JobType = AdminJob["type"];
export type JobScope = CatalogJobConfig["scope"];
export type JobKind = CatalogJobConfig["kind"];

export interface NewJobDraft {
  readonly name: string;
  readonly type: JobType;
  /** The chosen playlist's id as the select holds it; empty until one is chosen (the first is shown). */
  readonly playlistId: string;
  readonly scope: JobScope;
  readonly kind: JobKind;
}

export const EMPTY_NEW_JOB: NewJobDraft = {
  name: "",
  type: "playlist",
  playlistId: "",
  scope: "trending",
  kind: "movie",
};

export const sameNewJob = (a: NewJobDraft, b: NewJobDraft): boolean =>
  a.name === b.name && a.type === b.type && a.playlistId === b.playlistId && a.scope === b.scope && a.kind === b.kind;

/** The playlist a playlist job would sync: the one chosen, or the select's first option when none was touched. */
export function chosenPlaylist(picked: string, options: readonly { readonly id: number }[]): string {
  if (picked !== "" && options.some((option) => String(option.id) === picked)) return picked;
  const first = options[0];
  return first === undefined ? "" : String(first.id);
}

export interface JobDraft {
  readonly name: string;
  readonly enabled: boolean;
  readonly playlistId: string;
  readonly scope: JobScope;
  readonly kind: JobKind;
  /** A catalog job's page count, as typed. */
  readonly pages: string;
  /** The interval, as typed: `6h`, `30m`, `24h`, `off`. */
  readonly schedule: string;
}

export function draftOf(job: AdminJob): JobDraft {
  const catalog = catalogConfigOf(job);
  return {
    name: job.name,
    enabled: job.enabled,
    playlistId: String(playlistIdOf(job) ?? ""),
    scope: catalog?.scope ?? "trending",
    kind: catalog?.kind ?? "movie",
    pages: catalog === null ? "" : String(catalog.pages),
    schedule: job.schedule,
  };
}

export const sameJobDraft = (a: JobDraft, b: JobDraft): boolean =>
  a.name === b.name &&
  a.enabled === b.enabled &&
  a.playlistId === b.playlistId &&
  a.scope === b.scope &&
  a.kind === b.kind &&
  a.pages === b.pages &&
  a.schedule === b.schedule;

/** The once-only override the workspace's `Run job` sends for a playlist job, starting from the job's own flags. */
export interface RunToggles {
  readonly dryRun: boolean;
  readonly prune: boolean;
}

export function togglesOf(job: AdminJob): RunToggles {
  const config = job.type === "playlist" && "dryRun" in job.config ? job.config : null;
  return { dryRun: config?.dryRun ?? false, prune: config?.prune ?? false };
}
