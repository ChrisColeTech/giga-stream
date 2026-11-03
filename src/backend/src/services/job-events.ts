import { AppError, ERRORS } from "../constants/errors.js";
import { EVENT_SUBSCRIBERS_MAX } from "../constants/limits.js";
import type { JobEvent } from "../types/job-progress.js";
import type { JobProgressRegistry } from "./job-progress.js";

/** The writable end of one open stream: Node's `ServerResponse` fits it, and so does a test's fake. */
export interface EventSink {
  /** False when the sink's buffer is full: the subscriber is ended (progress is idempotent; a new stream re-syncs). */
  write(chunk: string): boolean;
  end(): void;
}

const frame = (name: string, data: unknown): string => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

function frameOf(event: JobEvent): string {
  if (event.type === "progress") return frame("progress", event.progress);
  const { type: _type, ...finished } = event;
  return frame("finished", finished);
}

/**
 * The stream of job progress (docs/44 section 3.3): a `snapshot` of the running jobs when a client connects, then
 * `progress` and `finished` as they happen. It owns the subscribers; the route owns the HTTP. There is no heartbeat and no
 * timer of its own, and no queue: a sink that cannot take a write is ended.
 */
export function createJobEvents(deps: { progress: JobProgressRegistry; enabled?: boolean }) {
  const { progress } = deps;
  const sinks = new Set<EventSink>();

  function end(sink: EventSink): void {
    try {
      sink.end();
    } catch {
      // a socket that is already gone
    }
  }

  function drop(sink: EventSink): void {
    if (sinks.delete(sink)) end(sink);
  }

  function write(sink: EventSink, text: string): void {
    let accepted = false;
    try {
      accepted = sink.write(text);
    } catch {
      // a closed socket counts as a refused write
    }
    if (!accepted) drop(sink);
  }

  if (deps.enabled !== false) progress.subscribe((event) => {
    const text = frameOf(event);
    for (const sink of [...sinks]) write(sink, text);
  });

  /** Throws `429 job.events_busy` while `EVENT_SUBSCRIBERS_MAX` streams are open. */
  function assertRoom(): void {
    if (sinks.size >= EVENT_SUBSCRIBERS_MAX) throw new AppError(ERRORS.jobEventsBusy, { max: EVENT_SUBSCRIBERS_MAX });
  }

  return {
    assertRoom,

    /**
     * Subscribes `sink` and writes its `snapshot` in the same synchronous step, so no `finished` falls between the two.
     * Answers the function that ends the subscription (safe to call again).
     */
    attach(sink: EventSink): () => void {
      // A passive API must not hold a billable request open or imply remote in-memory progress.
      if (deps.enabled === false) {
        try { sink.write(frame("snapshot", { running: [] })); } catch {
          // Even a disconnected or backpressured client must release this request.
        } finally { end(sink); }
        return () => undefined;
      }
      assertRoom();
      sinks.add(sink);
      write(sink, frame("snapshot", { running: progress.running() }));
      return () => drop(sink);
    },

    count: (): number => sinks.size,

    /** Shutdown: every open stream is ended, so none holds the server open. */
    closeAll(): void {
      for (const sink of [...sinks]) drop(sink);
    },
  };
}

export type JobEvents = ReturnType<typeof createJobEvents>;
