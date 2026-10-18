import type { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import type { CatalogJobConfig, JobRecord } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import { type JobInput, type JobPatch, type JobView, CatalogConfigSchema } from "../types/job.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { JobProgressRegistry } from "./job-progress.js";
import type { JobRunner } from "./job-runner.js";
import { normalisePlaylistSchedule, normaliseSchedule } from "./job-schedule.js";
import { DEFAULT_DISCOVER_PAGES, DEFAULT_SYNC_PAGES } from "./title-shapes.js";

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.jobInvalid, { field }, message);

/** The field a config issue names: its path, or - for a key the type does not have - that key. */
const configField = (issue: z.ZodIssue | undefined): string => {
  if (issue?.code === "unrecognized_keys") return `config.${issue.keys.join(",")}`;
  return `config.${issue?.path.join(".") ?? ""}`;
};

/** A recent job's `pages` is the constant `1`: it is required in every stored config and ignored by the run (docs/49 2.1). */
const RECENT_PAGES = 1;

const pagesOf = (scope: string, pages: number | undefined): number => {
  if (scope === "recent") return RECENT_PAGES;
  return pages ?? (scope === "discover" ? DEFAULT_DISCOVER_PAGES : DEFAULT_SYNC_PAGES);
};

/** The config a catalog job stores: a Library update has no kind; the others keep what they were given. */
type ConfigInput = { scope: CatalogJobConfig["scope"]; kind?: "movie" | "tv"; pages?: number };
const configOf = (config: ConfigInput): CatalogJobConfig => ({
  scope: config.scope,
  ...(config.scope !== "recent" && config.kind !== undefined && { kind: config.kind }),
  pages: pagesOf(config.scope, config.pages),
});

/**
 * The sync jobs (docs/26 section 3.11, docs/43 section 3.1). A playlist job is part of its playlist: made and
 * deleted with it, never by `POST /api/jobs`, never deleted here (`422 job.invalid`), and changed only in `enabled`
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

  function view(job: JobRecord): JobView {
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
    const playlistName = store.playlists.find(job.playlistId)?.name;
    return {
      ...common, name: `Sync ${playlistName ?? "playlist"}`, type: "playlist", config: { playlistId: job.playlistId },
      playlistId: job.playlistId, ...(playlistName !== undefined && { playlistName }),
    };
  }

  function existing(id: number): JobRecord {
    const found = store.jobs.find(id);
    if (!found) throw new AppError(ERRORS.jobNotFound, { id });
    return found;
  }

  return {
    view,
    list: (): { items: JobView[] } => ({ items: store.jobs.list().map(view) }),
    get: (id: number): JobView => view(existing(id)),

    create(input: JobInput, actor: Actor): JobView {
      const config = configOf(input.config);
      const id = store.jobs.insertCatalog(
        { name: input.name, enabled: input.enabled ?? true, schedule: normaliseSchedule(input.schedule ?? "off"), config },
        now(),
      );
      audit.record(actor, { action: "job.created", subject: String(id), detail: { name: input.name, type: input.type } });
      onChange();
      return view(existing(id));
    },

    update(id: number, patch: JobPatch, actor: Actor): JobView {
      const current = existing(id);
      const enabled = patch.enabled ?? current.enabled;
      if (current.type === "playlist") {
        if (patch.name !== undefined) throw invalid("name", "A playlist's job is named after its playlist.");
        if (patch.config !== undefined) throw invalid("config", "A playlist's job has no settings.");
        const schedule = patch.schedule === undefined ? current.schedule : normalisePlaylistSchedule(patch.schedule);
        store.jobs.update({ ...current, enabled, schedule });
      } else {
        const parsed = CatalogConfigSchema.safeParse({ ...current.config, ...patch.config });
        if (!parsed.success) throw invalid(configField(parsed.error.issues[0]), "That config is not valid.");
        const schedule = patch.schedule === undefined ? current.schedule : normaliseSchedule(patch.schedule);
        const config = configOf(parsed.data);
        store.jobs.update({ ...current, name: patch.name ?? current.name, enabled, schedule, config });
      }
      const name = current.type === "catalog" ? (patch.name ?? current.name) : view(current).name;
      audit.record(actor, { action: "job.updated", subject: String(id), detail: { name, fields: Object.keys(patch) } });
      onChange();
      return view(existing(id));
    },

    /** An admin's run: STARTED and answered at once (`202`, `running`); the result is read on a refresh. */
    run(id: number, actor: Actor): JobView {
      runner.run(existing(id), actor);
      return view(existing(id));
    },

    /**
     * Starts the Library fill (the first catalog job with the discover scope) for `POST /api/titles/sync`, the same run
     * as `Run job`: stoppable, reporting progress, refused when the job is disabled. `409 job.no_library_fill` when none.
     */
    startLibraryFill(actor: Actor): JobView {
      const fill = store.jobs.list().find((job) => job.type === "catalog" && job.config.scope === "discover");
      if (fill === undefined) throw new AppError(ERRORS.jobNoLibraryFill);
      runner.run(fill, actor);
      return view(existing(fill.id));
    },

    /**
     * `Stop` (docs/43 section 3.4a, docs/44 section 3.2), playlist and catalog jobs alike: cancels the run in progress
     * and keeps everything already written. The run ends within seconds (its requests abort); the job reads `running`
     * until then.
     */
    stop(id: number, actor: Actor): JobView {
      const current = existing(id);
      if (!runner.abort(id)) throw new AppError(ERRORS.jobNotRunning, { id });
      audit.record(actor, { action: "job.stopped", subject: String(id), detail: { name: view(current).name } });
      return view(existing(id));
    },

    remove(id: number, actor: Actor): { id: number } {
      const current = existing(id);
      if (current.type === "playlist") throw invalid("id", "A playlist's job goes with the playlist.");
      store.jobs.remove(id);
      audit.record(actor, { action: "job.deleted", subject: String(id), detail: { name: current.name, type: current.type } });
      onChange();
      return { id };
    },
  };
}

export type JobService = ReturnType<typeof createJobService>;
