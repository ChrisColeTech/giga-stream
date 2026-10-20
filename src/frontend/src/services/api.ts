import type { z } from "zod";
import { createApi } from "@giga/http/create-api";
import type { RequestOptions } from "@giga/http/request-types";
import { SESSION_ENDED_NOTICE } from "@/constants/gate-copy";
import { SENTENCES } from "@/lib/error-sentence";
import { restEvent } from "@/lib/event-log";
import { useAppStore } from "@/store/app-store";
import type { EventArea } from "@/types/events";

export { ApiError } from "@giga/http/api-error";

export type ApiOptions = RequestOptions<EventArea>;

/* The interface's one request layer (`01` section 4.1) is the shared createApi: this adapter names the fileserver's
 * failure codes, turns each finished request into a row of the events log - the row names the host and the outcome,
 * never the address - and, since `62` D4, attaches the signed-in session's bearer. */

/** The access token lives in the store, in memory, and nowhere else; the header is read at each call, so a sign-in,
 *  a refresh of the session or a sign-out is carried by the very next request. Signed out, no header is sent. */
function bearer(): Readonly<Record<string, string>> {
  const tokens = useAppStore.getState().tokens;
  return tokens === null ? {} : { authorization: `Bearer ${tokens.accessToken}` };
}

/** A 401 under a live session ends it: the gate returns with its sentence (`62` section 3.5). The gate's own refusals
 *  are 401s too - a wrong password at sign-in, a refused restore - but there is no session to end then, and this
 *  stays silent for them. */
function onUnauthorized(): void {
  const state = useAppStore.getState();
  if (state.signedIn) state.endSession(SESSION_ENDED_NOTICE);
}

const client = createApi<EventArea>({
  sentences: SENTENCES,
  failureCodes: { invalid: "response.invalid", unreachable: "fileserver.unreachable" },
  defaultArea: "Connection",
  headers: bearer,
  onUnauthorized,
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
