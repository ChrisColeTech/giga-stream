import {
  restEvent as sharedRestEvent,
  type EventInput as SharedEventInput,
  type RequestOutcome,
} from "@giga/ui/lib/event-log";
import type { EventArea } from "@/types/events";

/* The events log is the shared library's (`docs/27` step 6). The interface's rows name the fileserver as their host. */
export { appendEvent, EVENT_LOG_LIMIT } from "@giga/ui/lib/event-log";

export type EventInput = SharedEventInput<EventArea>;

/** One finished REST request as a row of the interface's log: the host and the outcome, never the address. */
export function restEvent(method: string, status: RequestOutcome, elapsedMs: number, area: EventArea): EventInput {
  return sharedRestEvent("fileserver", method, status, elapsedMs, area);
}
