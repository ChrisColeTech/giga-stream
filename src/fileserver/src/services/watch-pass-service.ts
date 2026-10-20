import { AppError } from "../lib/app-error.js";
import { badResponse, unreachable } from "./admin-client.js";

/** How long one passed-on write may take before it counts as the backend not answering. */
const PASS_TIMEOUT_MS = 10_000;

/** One call passed on to the backend's account watch routes (docs/63 section 3.2). */
export interface WatchPassCall {
  method: "PUT" | "DELETE";
  /** The path after `/api/account/watch`: empty for the collection, `/id` for one entry. */
  tail: string;
  /** The JSON body, when the verb carries one. */
  body?: unknown;
  /** The caller's own `authorization` header, forwarded intact — the cloud row is per account. */
  authorization: string;
}

/**
 * The browser side of the watch fork (docs/63 section 3.2): the backend's `/api/account/watch` is
 * the cloud home of a signed-in browser's history, and this pass is the whole of the fileserver's
 * relationship with it. One fetch per call — the identical verb, body and path tail, the caller's
 * bearer carried intact — and the backend's envelope answer returned verbatim, status included. A
 * transport failure answers the standard `backend.unreachable`, an unreadable body
 * `backend.bad_response`: the same refusals the backend cache answers (docs/46).
 */
export interface WatchPass {
  forward: (call: WatchPassCall) => Promise<{ status: number; envelope: unknown }>;
}

export function createWatchPass(deps: { baseUrl: string; fetch?: typeof fetch }): WatchPass {
  const doFetch = deps.fetch ?? globalThis.fetch;
  return {
    async forward(call) {
      // No backend to pass to — the desktop's proxy-off shape — earns the same answer as a dead one.
      if (deps.baseUrl === "") throw new AppError(unreachable.code, unreachable.status, unreachable.message);
      let status: number;
      let text: string;
      try {
        const response = await doFetch(`${deps.baseUrl}/api/account/watch${call.tail}`, {
          method: call.method,
          headers: {
            authorization: call.authorization,
            ...(call.body !== undefined && { "content-type": "application/json" }),
          },
          ...(call.body !== undefined && { body: JSON.stringify(call.body) }),
          credentials: "omit",
          redirect: "error",
          signal: AbortSignal.timeout(PASS_TIMEOUT_MS),
        });
        status = response.status;
        text = await response.text();
      } catch (cause) {
        throw new AppError(unreachable.code, unreachable.status, unreachable.message, undefined, cause);
      }
      try {
        const envelope: unknown = JSON.parse(text);
        return { status, envelope };
      } catch (cause) {
        throw new AppError(badResponse.code, badResponse.status, badResponse.message, undefined, cause);
      }
    },
  };
}
