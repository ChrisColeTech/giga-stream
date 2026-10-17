import type { z } from "zod";
import { createApi } from "@giga/http/create-api";
import type { RequestOptions } from "@giga/http/request-types";
import { SENTENCES } from "@/lib/error-sentence";
import { restEvent } from "@/lib/event-log";
import { useAppStore } from "@/store/app-store";
import type { EventArea } from "@/types/events";

export { ApiError } from "@giga/http/api-error";

export type ApiOptions = RequestOptions<EventArea>;

/* The interface's one request layer (`01` section 4.1) is the shared createApi: this adapter names the fileserver's
 * failure codes and turns each finished request into a row of the events log. The row names the host and the outcome,
 * never the address. */
const client = createApi<EventArea>({
  sentences: SENTENCES,
  failureCodes: { invalid: "response.invalid", unreachable: "fileserver.unreachable" },
  defaultArea: "Connection",
  onEvent: (event) =>
    useAppStore.getState().logEvent(restEvent(event.method, event.status, event.elapsedMs, event.area)),
});

export function api<T>(path: string, schema: z.ZodType<T>, options: ApiOptions = {}): Promise<T> {
  return client.api(path, schema, options);
}

/** The scan is the only route whose successful answer is a streamed body rather than an envelope. */
export function apiStream(path: string, options: ApiOptions = {}): Promise<ReadableStream<Uint8Array>> {
  return client.apiStream(path, options);
}
