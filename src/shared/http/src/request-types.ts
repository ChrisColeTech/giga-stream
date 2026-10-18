import type { z } from "zod";
import type { SentenceTable } from "./error-sentence";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** An HTTP status, or the outcome of a request that never got one. */
export type RequestStatus = number | "aborted" | "invalid" | "unreachable";

/** The one fetch shape the layer calls; a test injects its own. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RequestOptions<Area extends string> {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  /** A multipart body (a file upload): sent as is with NO content type, so the runtime adds the boundary. */
  readonly form?: FormData;
  readonly signal?: AbortSignal;
  /** The events area of the request; the config's default when absent. */
  readonly area?: Area;
  /** Lets the request outlive the page (a write made as the window closes). */
  readonly keepalive?: boolean;
  /** A success is not reported (a periodic progress write); a failure still is. */
  readonly quiet?: boolean;
}

/** What one finished request reports. It names the method, the outcome and the area, never the address. */
export interface RequestEvent<Area extends string> {
  readonly method: HttpMethod;
  readonly status: RequestStatus;
  readonly elapsedMs: number;
  readonly area: Area;
}

/** The codes the layer itself raises when an answer is unreadable or the server cannot be reached. */
export interface FailureCodes {
  readonly invalid: string;
  readonly unreachable: string;
}

export interface ApiConfig<Area extends string> {
  readonly sentences: SentenceTable;
  readonly failureCodes: FailureCodes;
  readonly defaultArea: Area;
  /** Prefixed to every path; empty for the same origin. */
  readonly base?: string;
  /** Extra headers, read on every request (a bearer token can change between calls). */
  readonly headers?: () => Readonly<Record<string, string>>;
  /** Called once per finished request, unless it is a quiet success. */
  readonly onEvent?: (event: RequestEvent<Area>) => void;
  /** Called on a 401, before the refusal is thrown. */
  readonly onUnauthorized?: () => void;
  /** Defaults to the global fetch, read at each call. */
  readonly fetch?: FetchLike;
  /** Defaults to `performance.now`. */
  readonly now?: () => number;
}

export interface ApiClient<Area extends string> {
  api<T>(path: string, schema: z.ZodType<T>, options?: RequestOptions<Area>): Promise<T>;
  apiStream(path: string, options?: RequestOptions<Area>): Promise<ReadableStream<Uint8Array>>;
}
