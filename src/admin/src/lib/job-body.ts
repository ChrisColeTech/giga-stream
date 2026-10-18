import type { AdminJob, CatalogJobConfig } from "@/services/schemas/job-schema";
import type { JobDraft, NewJobDraft } from "./job-draft";
import { catalogConfigOf, playlistIdOf } from "./job-rows";

/* The request bodies of the Jobs routes (`29` section 9.5), pure. A create is discriminated by `type`; a catalog job's
 * `pages` is left to the backend's default. A PATCH carries only what changed, and its `config` only the changed keys:
 * the backend merges it over the job's own config and checks it against the job's type, which never changes. */

export type JobCreateBody =
  | { readonly type: "playlist"; readonly name: string; readonly config: { readonly playlistId: number } }
  | {
      readonly type: "catalog";
      readonly name: string;
      readonly config: { readonly scope: CatalogJobConfig["scope"]; readonly kind: CatalogJobConfig["kind"] };
    };

/** `POST /api/jobs`: the trimmed name and the type's own config; `playlistId` is the select's chosen value. */
export function createBody(draft: NewJobDraft, playlistId: string): JobCreateBody {
  const name = draft.name.trim();
  return draft.type === "playlist"
    ? { type: "playlist", name, config: { playlistId: Number(playlistId) } }
    : { type: "catalog", name, config: { scope: draft.scope, kind: draft.kind } };
}

/* Type aliases, not interfaces: a request body is a plain record (`RecordInput`), which an interface cannot be. */
export type JobConfigPatch = {
  readonly playlistId?: number;
  readonly scope?: CatalogJobConfig["scope"];
  readonly kind?: CatalogJobConfig["kind"];
  readonly pages?: number;
};

export type JobPatch = {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly schedule?: string;
  readonly config?: JobConfigPatch;
};

function configChanges(job: AdminJob, draft: JobDraft): JobConfigPatch {
  const catalog = catalogConfigOf(job);
  if (catalog === null) {
    const playlistId = Number(draft.playlistId);
    return draft.playlistId !== "" && playlistId !== playlistIdOf(job) ? { playlistId } : {};
  }
  const pages = Number(draft.pages.trim());
  return {
    ...(draft.scope !== catalog.scope && { scope: draft.scope }),
    ...(draft.kind !== catalog.kind && { kind: draft.kind }),
    ...(pages !== catalog.pages && { pages }),
  };
}

/** `PATCH /api/jobs/:id`: only the fields that differ from the saved job, trimmed as the backend trims them. */
export function changedFields(job: AdminJob, draft: JobDraft): JobPatch {
  const name = draft.name.trim();
  const schedule = draft.schedule.trim().toLowerCase();
  const config = configChanges(job, draft);
  return {
    ...(name !== job.name && { name }),
    ...(draft.enabled !== job.enabled && { enabled: draft.enabled }),
    ...(schedule !== job.schedule && { schedule }),
    ...(Object.keys(config).length > 0 && { config }),
  };
}

export const isEmptyPatch = (patch: JobPatch): boolean => Object.keys(patch).length === 0;
