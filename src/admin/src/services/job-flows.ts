import { AUDIT_AFTER_WRITE, AUDIT_PAGE } from "@/constants/audit-limits";
import { JOB_GONE, jobCreated, jobDeleted, jobRan, jobSaved, jobStarted, unreadableJobs } from "@/constants/job-copy";
import type { BulkItem } from "@/lib/bulk-plan";
import type { JobBulkVerb } from "@/lib/job-bulk";
import { changedFields, createBody, isEmptyPatch } from "@/lib/job-body";
import { JOB_FIELDS, firstCreateRefusal, firstSaveRefusal, type JobField } from "@/lib/job-checks";
import type { JobDraft, NewJobDraft, RunToggles } from "@/lib/job-draft";
import { catalogConfigOf, runningCount } from "@/lib/job-rows";
import {
  BAD_ANSWER, DROPPED, codeOf, done, fieldOf, isUnreachable, sentenceOf, type FlowRefused, type FlowResult,
} from "@/lib/playlist-flow-result";
import { findById } from "@/lib/playlist-rows";
import type { AppState } from "@/store/app-store";
import type { JobsService } from "./jobs";
import type { PlaylistsService } from "./playlists";
import type { AdminJob } from "./schemas/job-schema";

/** The part of the store the flows read and write; `useAppStore.getState` satisfies it, a test passes the same. */
export type JobStore = Pick<
  AppState,
  | "serial" | "signedIn" | "jobs" | "workspaces" | "jobsStartLoad" | "jobsLoaded" | "jobsLoadFailed"
  | "jobsPlaylistsLoaded" | "jobUpsert" | "jobRemove" | "jobsMarkUnreachable" | "closeWorkspace" | "markStale" | "say"
  | "setWork"
>;

export interface JobFlowDeps {
  readonly service: JobsService;
  /** The playlists for the New form's select and the `Run job` gate: the service, never the Playlists slice. */
  readonly playlists: Pick<PlaylistsService, "list">;
  readonly store: () => JobStore;
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}

export type JobResult<T = undefined> = FlowResult<T, JobField>;

export interface JobFlows {
  load: () => Promise<JobResult>;
  refresh: () => Promise<JobResult>;
  create: (draft: NewJobDraft, playlistId: string) => Promise<JobResult>;
  save: (id: number, draft: JobDraft) => Promise<JobResult<AdminJob | null>>;
  remove: (id: number) => Promise<JobResult>;
  /** `Run job` on one job; a playlist job sends `toggles` as the once-only override. A refusal sits under `run`. */
  run: (id: number, toggles?: RunToggles) => Promise<JobResult>;
  /** One bulk verb's single-record call: null on success, the failure's sentence otherwise. */
  bulkCall: (verb: JobBulkVerb) => (item: BulkItem<number>) => Promise<string | null>;
}

/** The Jobs tab's orchestration (`38` section 4). Every write that lands in the jobs slice is followed by the
 *  statusbar's count, `setWork({ syncing })`: the jobs the last answer marked running (no timer, no polling). Each flow
 *  records the session's serial before it awaits and writes only if the session is unchanged after. */
export function createJobFlows(deps: JobFlowDeps): JobFlows {
  const { service, playlists, store, audit } = deps;
  const alive = (serial: number): boolean => store().signedIn && store().serial === serial;
  const syncWork = (): void => store().setWork({ syncing: runningCount(store().jobs.items) });
  const upsert = (job: AdminJob): void => { store().jobUpsert(job); syncWork(); };
  const drop = (id: number): void => { store().jobRemove(id); syncWork(); };
  /** A job made, changed or deleted changes which job `Sync now` runs on the Playlists tab. */
  const wrote = (): void => { store().markStale("playlists"); void audit.reload(AUDIT_AFTER_WRITE); };
  const say = (sentence: string): void => store().say(sentence, "info", "Job");
  const pressed = new Set<number>();
  const refuse = (sentence: string, field?: JobField): FlowRefused<JobField> => {
    store().say(sentence, "warn", "Job");
    return { ok: false, sentence, ...(field !== undefined && { field }) };
  };
  const refused = (error: unknown, fallback?: JobField): FlowRefused<JobField> => {
    if (isUnreachable(error)) store().jobsMarkUnreachable(true);
    return refuse(sentenceOf(error), fallback ?? fieldOf(error, JOB_FIELDS));
  };
  /** A write that failed may still have changed the job (a bad answer, a failed run that kept its outcome): re-read. */
  const failed = (error: unknown, fallback?: JobField): FlowRefused<JobField> => {
    const result = refused(error, fallback);
    if (codeOf(error) === BAD_ANSWER || (fallback === "run" && !isUnreachable(error))) void load();
    return result;
  };

  async function load(): Promise<JobResult> {
    if (store().jobs.status === "loading") return done(undefined);
    const serial = store().serial;
    store().jobsStartLoad();
    const [list, choices] = await Promise.allSettled([service.list(), playlists.list()]);
    if (!alive(serial)) return DROPPED;
    store().jobsPlaylistsLoaded(choices.status === "fulfilled" ? choices.value.items : null);
    if (list.status === "rejected") {
      store().jobsLoadFailed(isUnreachable(list.reason));
      return refused(list.reason);
    }
    store().jobsLoaded(list.value.items);
    syncWork();
    if (list.value.unreadable > 0) store().say(unreadableJobs(list.value.unreadable), "warn", "Job");
    return done(undefined);
  }

  async function create(draft: NewJobDraft, playlistId: string): Promise<JobResult> {
    const bad = firstCreateRefusal(draft);
    if (bad !== null) return refuse(bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const job = await service.create(createBody(draft, playlistId));
      if (!alive(serial)) return DROPPED;
      upsert(job);
      say(jobCreated(job.name));
      wrote();
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? failed(error) : DROPPED;
    }
  }

  function gone(): FlowRefused<JobField> {
    store().closeWorkspace("jobs");
    void load();
    return refuse(JOB_GONE);
  }

  async function save(id: number, draft: JobDraft): Promise<JobResult<AdminJob | null>> {
    const job = findById(store().jobs.items, id);
    if (job === undefined) return gone();
    const bad = firstSaveRefusal(draft, catalogConfigOf(job) !== null);
    if (bad !== null) return refuse(bad.sentence, bad.field);
    const patch = changedFields(job, draft);
    if (isEmptyPatch(patch)) return done(null);
    const serial = store().serial;
    try {
      const saved = await service.update(id, patch);
      if (!alive(serial)) return DROPPED;
      upsert(saved);
      say(jobSaved(saved.name));
      wrote();
      return done(saved);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      return codeOf(error) === "job.not_found" ? gone() : failed(error);
    }
  }

  async function remove(id: number): Promise<JobResult> {
    const job = findById(store().jobs.items, id);
    if (job === undefined) return gone();
    const serial = store().serial;
    try {
      await service.remove(id);
      if (!alive(serial)) return DROPPED;
      drop(id);
      if (store().workspaces.jobs === String(id)) store().closeWorkspace("jobs");
      say(jobDeleted(job.name));
      wrote();
      return done(undefined);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      if (codeOf(error) === "job.not_found") drop(id);
      return failed(error);
    }
  }

  async function run(id: number, toggles?: RunToggles): Promise<JobResult> {
    const job = findById(store().jobs.items, id);
    if (job === undefined) return gone();
    if (pressed.has(id)) return done(undefined);
    pressed.add(id);
    const serial = store().serial;
    try {
      const answer = await service.run(id, job.type === "playlist" ? toggles : undefined);
      if (!alive(serial)) return DROPPED;
      upsert(answer);
      say(answer.running ? jobStarted(answer.name) : jobRan(answer.name, answer.lastOutcome));
      if (answer.type === "playlist") for (const tab of ["playlists", "channels"] as const) store().markStale(tab);
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? failed(error, "run") : DROPPED;
    } finally {
      pressed.delete(id);
    }
  }

  const bulkCall: JobFlows["bulkCall"] = (verb) => async (item) => {
    try {
      if (verb === "delete") drop((await service.remove(item.id)).id);
      else if (verb === "run") upsert(await service.run(item.id));
      else upsert(await service.update(item.id, { enabled: verb === "enable" }));
      return null;
    } catch (error: unknown) {
      if (isUnreachable(error)) store().jobsMarkUnreachable(true);
      return sentenceOf(error);
    }
  };

  const refresh = async (): Promise<JobResult> => {
    const [result] = await Promise.all([load(), audit.reload(AUDIT_PAGE)]);
    return result;
  };

  return { load, refresh, create, save, remove, run, bulkCall };
}
