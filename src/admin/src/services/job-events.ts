import { STALE_ON_RUN_END, streamEndPlan } from "@/lib/job-events-plan";
import { vanished } from "@/lib/live-jobs";
import type { AppState } from "@/store/app-store";
import {
  FinishedSchema, JobProgressSchema, SnapshotSchema, type JobEvent,
} from "./schemas/job-event-schema";
import type { SessionApi } from "./session-api";
import { createSseParser, type SseFrame } from "./sse-parser";

/** The route (`44` section 3.3): one read-only stream of server-sent events, signed in, authorized at connect. */
export const JOB_EVENTS_PATH = "/api/jobs/events";

/** The part of the store the stream writes; `useAppStore.getState` satisfies it, a test passes the same. */
export type JobEventsStore = Pick<
  AppState,
  "jobProgress" | "jobProgressSnapshot" | "jobProgressUpdate" | "jobProgressFinished" | "jobProgressClear"
  | "jobsApplyProgress" | "markStale"
>;

/** A frame as an event, or null for one the admin does not understand (an unknown name, bad JSON, a wrong shape): such a
 *  frame is ignored, never an error. */
export function decodeFrame(frame: SseFrame): JobEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(frame.data);
  } catch {
    return null;
  }
  if (frame.event === "snapshot") {
    const parsed = SnapshotSchema.safeParse(value);
    return parsed.success ? { type: "snapshot", running: parsed.data.running } : null;
  }
  if (frame.event === "progress") {
    const parsed = JobProgressSchema.safeParse(value);
    return parsed.success ? { type: "progress", progress: parsed.data } : null;
  }
  if (frame.event === "finished") {
    const parsed = FinishedSchema.safeParse(value);
    return parsed.success ? { type: "finished", finished: parsed.data } : null;
  }
  return null;
}

/** One event into the store. A `snapshot` is authoritative: a job it leaves out has finished, so the lists are old. A
 *  `finished` leaves the lists old too (the new result is read, not pushed). */
export function applyEvent(store: () => JobEventsStore, event: JobEvent): void {
  const now = store();
  const before = now.jobProgress.live;
  if (event.type === "snapshot") now.jobProgressSnapshot(event.running);
  else if (event.type === "progress") now.jobProgressUpdate(event.progress);
  else now.jobProgressFinished(event.finished.jobId);
  const after = store().jobProgress.live;
  store().jobsApplyProgress(after.map((entry) => entry.progress));
  const ended = event.type === "finished" || (event.type === "snapshot" && vanished(before, after).length > 0);
  if (ended) for (const tab of STALE_ON_RUN_END) store().markStale(tab);
}

/** Reads the body to its end, handing every understood frame on. Partial chunks wait for their rest. */
export async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: JobEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || signal.aborted) return;
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        const event = decodeFrame(frame);
        if (event !== null && !signal.aborted) onEvent(event);
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}

export interface JobEventsDeps {
  readonly stream: SessionApi["stream"];
  readonly store: () => JobEventsStore;
}

/** Opens the stream once and follows it to its end. It never retries: the hook opens another on a new token, a focus or a
 *  Refresh. A stream that ends by itself (or never opened) forgets the progress and marks the lists old; one the app
 *  aborted leaves both for the next stream's snapshot. */
export async function runJobEvents(deps: JobEventsDeps, signal: AbortSignal): Promise<void> {
  const { stream, store } = deps;
  try {
    const body = await stream(JOB_EVENTS_PATH, { signal, quiet: true });
    await consumeStream(body, (event) => applyEvent(store, event), signal);
  } catch {
    /* the connection dropped, the server refused, the app aborted: all end the same way */
  }
  const plan = streamEndPlan(signal.aborted);
  if (plan.clear) {
    store().jobProgressClear();
    store().jobsApplyProgress([]);
  }
  for (const tab of plan.stale) store().markStale(tab);
}
