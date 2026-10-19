import type { AdminJob, CatalogJobConfig } from "@/services/schemas/job-schema";
import { type JobDraft, hasPages, walksBothKinds } from "./job-draft";
import { catalogConfigOf } from "./job-rows";

/* The request bodies of the Jobs routes (`03` section 7.2c, `43` section 3.1), pure. A create is a catalog job (a
 * playlist's job is made with the playlist) and sends the shared form's values. A PATCH carries only what
 * changed; a playlist job takes `enabled` and `schedule` only, and a catalog job's `config` only the changed keys: the
 * backend merges it over the job's own. */

/* Type aliases, not interfaces: a request body is a plain record (`RecordInput`), which an interface cannot be. */
export type JobCreateBody = {
  readonly type: "catalog";
  readonly name: string;
  readonly enabled: boolean;
  readonly schedule: string;
  readonly config: { readonly scope: CatalogJobConfig["scope"]; readonly kind?: JobKindWord; readonly pages?: number };
};
type JobKindWord = NonNullable<CatalogJobConfig["kind"]>;

/** `POST /api/jobs`: the trimmed name and the scope; a discover or recent job covers both kinds, so it sends none. */
export function createBody(draft: JobDraft): JobCreateBody {
  const config = walksBothKinds(draft.scope)
    ? { scope: draft.scope }
    : { scope: draft.scope, kind: draft.kind, pages: Number(draft.pages.trim()) };
  return {
    type: "catalog",
    name: draft.name.trim(),
    enabled: draft.enabled,
    schedule: draft.schedule.trim().toLowerCase(),
    config,
  };
}

export type JobConfigPatch = {
  readonly scope?: CatalogJobConfig["scope"];
  readonly kind?: JobKindWord;
  readonly pages?: number;
};

export type JobPatch = {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly schedule?: string;
  readonly config?: JobConfigPatch;
};

function configChanges(catalog: CatalogJobConfig, draft: JobDraft): JobConfigPatch {
  const pages = Number(draft.pages.trim());
  const kind = !walksBothKinds(draft.scope) && draft.kind !== catalog.kind;
  return {
    ...(draft.scope !== catalog.scope && { scope: draft.scope }),
    ...(kind && { kind: draft.kind }),
    ...(hasPages(draft.scope) && pages !== catalog.pages && { pages }),
  };
}

/** `PATCH /api/jobs/:id`: only the fields that differ from the saved job, trimmed as the backend trims them. */
export function changedFields(job: AdminJob, draft: JobDraft): JobPatch {
  const schedule = draft.schedule.trim().toLowerCase();
  const scheduleAndEnabled: JobPatch = {
    ...(draft.enabled !== job.enabled && { enabled: draft.enabled }),
    ...(schedule !== job.schedule && { schedule }),
  };
  const catalog = catalogConfigOf(job);
  if (catalog === null) return scheduleAndEnabled;
  const name = draft.name.trim();
  const config = configChanges(catalog, draft);
  return {
    ...(name !== job.name && { name }),
    ...scheduleAndEnabled,
    ...(Object.keys(config).length > 0 && { config }),
  };
}

export const isEmptyPatch = (patch: JobPatch): boolean => Object.keys(patch).length === 0;
