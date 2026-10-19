import type { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import type { CatalogJobConfig, JobRecord } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import { type JobInput, type JobPatch, type JobView, CatalogConfigSchema } from "../types/job.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { JobProgressRegistry } from "./job-progress.js";
import type { JobRunner } from "./job-runner.js";
import { normalisePlaylistSchedule, normaliseSchedule } from "./job-schedule.js";
import { DEFAULT_SYNC_PAGES } from "./title-shapes.js";

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.jobInvalid, { field }, message);

/** The field a config issue names: its path, or - for a key the type does not have - that key. */
const configField = (issue: z.ZodIssue | undefined): string => {
  if (issue?.code === "unrecognized_keys") return `config.${issue.keys.join(",")}`;
  return `config.${issue?.path.join(".") ?? ""}`;
};

type ConfigInput = {
  scope: CatalogJobConfig["scope"];
  kind?: "all" | "movie" | "tv";
  pages?: number;
};

/** Both-kind scopes store only their scope; omitted legacy list Kind retains its historical Movies meaning. */
const configOf = (config: ConfigInput): CatalogJobConfig =>
  config.scope === "discover" || config.scope === "recent"
    ? { scope: config.scope }
    : { scope: config.scope, kind: config.kind ?? "movie", pages: config.pages ?? DEFAULT_SYNC_PAGES };

/**
 * The sync jobs (docs/26 section 3.11, docs/43 section 3.1). A playlist job is part of its playlist: made and
 * deleted with it, never by `POST /api/admin/jobs`, never deleted here (`422 job.invalid`), and changed only in `enabled`
 * and `schedule` (at least 15 minutes). A catalog job names a scope, a kind and a page count. `onChange` re-arms the
 * backend's one scheduler when a job is made, changed or deleted.
 */
export function createJobService(deps: {
  store: Store;
  audit: AuditService;
  now: () => number;
  runner: JobRunner;
  progress: JobProgressRegistry;
  onChange: () => void;
}) {
  const { store, audit, now, runner, progress, onChange } = deps;

  async function view(job: JobRecord): Promise<JobView> {
    const running = runner.isRunning(job.id);
    const live = running ? progress.get(job.id) : undefined;
    const common = {
      id: job.id,
      enabled: job.enabled,
      schedule: job.schedule,
      running,
      ...(live !== undefined && { progress: live }),
      ...(job.lastRunAt !== undefined && { lastRunAt: job.lastRunAt }),
      ...(job.lastResult !== undefined && { lastResult: job.lastResult }),
      ...(job.lastCounts !== undefined && { lastCounts: job.lastCounts }),
      createdAt: job.createdAt,
    };
    if (job.type === "catalog") return { ...common, name: job.name, type: "catalog", config: job.config };
    const playlistName = (await store.playlists.find(job.playlistId))?.name;
    return {
      ...common, name: `Sync ${playlistName ?? "playlist"}`, type: "playlist", config: { playlistId: job.playlistId },
      playlistId: job.playlistId, ...(playlistName !== undefined && { playlistName }),
    };
  }

  async function existing(id: number): Promise<JobRecord> {
    const found = await store.jobs.find(id);
    if (!found) throw new AppError(ERRORS.jobNotFound, { id });
    return found;
  }

  return {
    view,
    list: async (): Promise<{ items: JobView[] }> => ({ items: await Promise.all((await store.jobs.list()).map(view)) }),
    get: async (id: number): Promise<JobView> => view(await existing(id)),

    create: async (input: JobInput, actor: Actor): Promise<JobView> => {
      const config = configOf(input.config);
      const id = await store.jobs.insertCatalog(
        { name: input.name, enabled: input.enabled ?? true, schedule: normaliseSchedule(input.schedule ?? "off"), config },
        now(),
      );
      await audit.record(actor, { action: "job.created", subject: String(id), detail: { name: input.name, type: input.type } });
      onChange();
      return view(await existing(id));
    },

    update: async (id: number, patch: JobPatch, actor: Actor): Promise<JobView> => {
      const current = await existing(id);
      const enabled = patch.enabled ?? current.enabled;
      if (current.type === "playlist") {
        if (patch.name !== undefined) throw invalid("name", "A playlist's job is named after its playlist.");
        if (patch.config !== undefined) throw invalid("config", "A playlist's job has no settings.");
        const schedule = patch.schedule === undefined ? current.schedule : normalisePlaylistSchedule(patch.schedule);
        await store.jobs.update({ ...current, enabled, schedule });
      } else {
        const parsed = CatalogConfigSchema.safeParse({ ...current.config, ...patch.config });
        if (!parsed.success) throw invalid(configField(parsed.error.issues[0]), "That config is not valid.");
        const schedule = patch.schedule === undefined ? current.schedule : normaliseSchedule(patch.schedule);
        const config = configOf(parsed.data);
        await store.jobs.update({ ...current, name: patch.name ?? current.name, enabled, schedule, config });
      }
      const name = current.type === "catalog" ? (patch.name ?? current.name) : (await view(current)).name;
      await audit.record(actor, { action: "job.updated", subject: String(id), detail: { name, fields: Object.keys(patch) } });
      onChange();
      return view(await existing(id));
    },

    /** An admin's run: STARTED and answered at once (`202`, `running`); the result is read on a refresh. */
    run: async (id: number, actor: Actor): Promise<JobView> => {
      await runner.run(await existing(id), actor);
      return view(await existing(id));
    },

    /**
     * Starts the Library fill (the first catalog job with the discover scope) for `POST /api/admin/titles/sync`, the same run
     * as `Run job`: stoppable, reporting progress, refused when the job is disabled. `409 job.no_library_fill` when none.
     */
    startLibraryFill: async (actor: Actor): Promise<JobView> => {
      const fill = (await store.jobs.list()).find((job) => job.type === "catalog" && job.config.scope === "discover");
      if (fill === undefined) throw new AppError(ERRORS.jobNoLibraryFill);
      await runner.run(fill, actor);
      return view(await existing(fill.id));
    },

    /**
     * `Stop` (docs/43 section 3.4a, docs/44 section 3.2), playlist and catalog jobs alike: cancels the run in progress
     * and keeps everything already written. The run ends within seconds (its requests abort); the job reads `running`
     * until then.
     */
    stop: async (id: number, actor: Actor): Promise<JobView> => {
      const current = await existing(id);
      if (!runner.abort(id)) throw new AppError(ERRORS.jobNotRunning, { id });
      await audit.record(actor, { action: "job.stopped", subject: String(id), detail: { name: (await view(current)).name } });
      return view(await existing(id));
    },

    remove: async (id: number, actor: Actor): Promise<{ id: number }> => {
      const current = await existing(id);
      if (current.type === "playlist") throw invalid("id", "A playlist's job goes with the playlist.");
      await store.jobs.remove(id);
      await audit.record(actor, { action: "job.deleted", subject: String(id), detail: { name: current.name, type: current.type } });
      onChange();
      return { id };
    },
  };
}

export type JobService = ReturnType<typeof createJobService>;
