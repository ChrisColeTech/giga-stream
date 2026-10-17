import type { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import type { JobRecord } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import {
  type JobInput, type JobPatch, type JobRun, type JobView, CatalogConfigSchema, PlaylistConfigSchema,
} from "../types/job.js";
import { refusalWithoutQuery } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { JobRunner } from "./job-runner.js";
import { normaliseSchedule } from "./job-schedule.js";
import { DEFAULT_SYNC_PAGES } from "./title-shapes.js";

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.jobInvalid, { field }, message);

/** The field a config issue names: its path, or - for a key the type does not have - that key. */
const configField = (issue: z.ZodIssue | undefined): string => {
  if (issue?.code === "unrecognized_keys") return `config.${issue.keys.join(",")}`;
  return `config.${issue?.path.join(".") ?? ""}`;
};

/** Counts as answered: a refusal example's address has no query or fragment (docs/29 section 18). */
function answeredCounts(counts: Record<string, unknown>): Record<string, unknown> {
  const examples = counts.refusalExamples;
  if (!Array.isArray(examples)) return counts;
  return { ...counts, refusalExamples: examples.map((e) => (typeof e === "string" ? refusalWithoutQuery(e) : e)) };
}

/**
 * The sync jobs (docs/26 section 3.11): records with a type, `Enabled`, a schedule and a config. A playlist job
 * names one playlist and syncs only that playlist's address; a catalog job names a scope, a kind and a page count.
 * `onChange` re-arms the backend's one scheduler when a job is made, changed or deleted.
 */
export function createJobService(deps: {
  store: Store;
  audit: AuditService;
  now: () => number;
  runner: JobRunner;
  onChange: () => void;
}) {
  const { store, audit, now, runner, onChange } = deps;
  const isRunning = runner.isRunning;

  function view(job: JobRecord): JobView {
    const playlist = job.type === "playlist" ? store.playlists.find(job.config.playlistId) : undefined;
    return {
      id: job.id,
      name: job.name,
      type: job.type,
      enabled: job.enabled,
      schedule: job.schedule,
      config: job.config,
      ...(playlist && { playlistName: playlist.name }),
      running: isRunning(job.id),
      ...(job.lastRunAt !== undefined && { lastRunAt: job.lastRunAt }),
      ...(job.lastOutcome !== undefined && { lastOutcome: job.lastOutcome }),
      ...(job.lastCounts !== undefined && { lastCounts: answeredCounts(job.lastCounts) }),
      createdAt: job.createdAt,
    };
  }

  function existing(id: number): JobRecord {
    const found = store.jobs.find(id);
    if (!found) throw new AppError(ERRORS.jobNotFound, { id });
    return found;
  }

  function checkPlaylist(playlistId: number): void {
    if (!store.playlists.find(playlistId)) throw invalid("config.playlistId", "That playlist does not exist.");
  }

  return {
    view,
    list: (): { items: JobView[] } => ({ items: store.jobs.list().map(view) }),
    get: (id: number): JobView => view(existing(id)),

    create(input: JobInput, actor: Actor): JobView {
      const schedule = normaliseSchedule(input.schedule ?? "off");
      const base = { name: input.name, enabled: input.enabled ?? true, schedule };
      let id: number;
      if (input.type === "playlist") {
        checkPlaylist(input.config.playlistId);
        const config = { playlistId: input.config.playlistId, dryRun: input.config.dryRun ?? false, prune: input.config.prune ?? false };
        id = store.jobs.insert({ ...base, type: "playlist", config }, now());
      } else {
        const config = { scope: input.config.scope, kind: input.config.kind, pages: input.config.pages ?? DEFAULT_SYNC_PAGES };
        id = store.jobs.insert({ ...base, type: "catalog", config }, now());
      }
      audit.record(actor, { action: "job.created", subject: String(id), detail: { name: input.name, type: input.type } });
      onChange();
      return view(existing(id));
    },

    update(id: number, patch: JobPatch, actor: Actor): JobView {
      const current = existing(id);
      const change = {
        name: patch.name ?? current.name,
        enabled: patch.enabled ?? current.enabled,
        schedule: patch.schedule === undefined ? current.schedule : normaliseSchedule(patch.schedule),
      };
      if (current.type === "playlist") {
        const parsed = PlaylistConfigSchema.safeParse({ ...current.config, ...patch.config });
        if (!parsed.success) throw invalid(configField(parsed.error.issues[0]), "That config is not valid.");
        checkPlaylist(parsed.data.playlistId);
        const config = { playlistId: parsed.data.playlistId, dryRun: parsed.data.dryRun ?? false, prune: parsed.data.prune ?? false };
        store.jobs.update({ ...current, ...change, config });
      } else {
        const parsed = CatalogConfigSchema.safeParse({ ...current.config, ...patch.config });
        if (!parsed.success) throw invalid(configField(parsed.error.issues[0]), "That config is not valid.");
        const config = { scope: parsed.data.scope, kind: parsed.data.kind, pages: parsed.data.pages ?? DEFAULT_SYNC_PAGES };
        store.jobs.update({ ...current, ...change, config });
      }
      audit.record(actor, {
        action: "job.updated",
        subject: String(id),
        detail: { name: change.name, fields: Object.keys(patch) },
      });
      onChange();
      return view(existing(id));
    },

    /** An admin's run (docs/26 section 3.11): refused when the job cannot run, `409 sync.busy` while it does. */
    async run(id: number, override: JobRun, actor: Actor): Promise<JobView> {
      await runner.run(existing(id), actor, override);
      return view(existing(id));
    },

    remove(id: number, actor: Actor): { id: number } {
      const current = existing(id);
      store.jobs.remove(id);
      audit.record(actor, { action: "job.deleted", subject: String(id), detail: { name: current.name, type: current.type } });
      onChange();
      return { id };
    },
  };
}

export type JobService = ReturnType<typeof createJobService>;
