import { z } from "zod";

import type { AppErrorCode } from "../types/envelope.js";

export const HEALTH_TIMEOUT_MS = 5_000;
export const CHANNELS_TIMEOUT_MS = 20_000;
/** A page larger than this is refused rather than buffered. */
export const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

export interface AdminFailure {
  code: Extract<AppErrorCode, "backend.unreachable" | "backend.bad_response" | "title.not_found">;
  message: string;
  /** The HTTP status for a route that surfaces this failure. */
  status: number;
}

export type AdminResult<T> = { ok: true; value: T } | { ok: false; failure: AdminFailure };

/** Every published channel, with the revision the backend reported. */
export interface PublishedChannels {
  items: AdminChannel[];
  revision: number;
}

/** The backend's public channel record (docs/03 section 7.2). */
export interface AdminChannel {
  id: string;
  name: string;
  category: string;
  number?: string;
  logoUrl?: string;
  revision: number;
  streamUrl: string;
}

export interface AdminClient {
  /** `GET /healthz` of the admin backend. */
  health(baseUrl: string, signal?: AbortSignal): Promise<AdminResult<unknown>>;
  /** `GET /api/channels` — the whole published list and its revision. */
  channels(baseUrl: string, signal?: AbortSignal): Promise<AdminResult<PublishedChannels>>;
}

export const unreachable: AdminFailure = {
  code: "backend.unreachable",
  message: "The admin backend did not answer.",
  status: 503,
};
export const badResponse: AdminFailure = {
  code: "backend.bad_response",
  message: "The admin backend sent an answer this app cannot use.",
  status: 502,
};

const ChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  category: z.string(),
  number: z.string().optional(),
  logoUrl: z.string().optional(),
  revision: z.number(),
  streamUrl: z.string().min(1),
});
const ChannelsSchema = z.object({
  items: z.array(ChannelSchema),
  revision: z.number(),
});
const DataEnvelope = z.object({ ok: z.literal(true), data: z.unknown() });
const AnyEnvelope = z.unknown();

/** Read at most `limit` bytes of the body; null when it is larger. */
async function readCapped(response: Response, limit: number): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * One completed GET of the admin backend, shared by every read (`01` section 7): bounded by a
 * timeout and the body by a size cap, no cookie, no redirect. A transport failure, an oversize or
 * non-JSON body answers its failure; any HTTP status answers its parsed JSON so the caller can map
 * its own refusals (the title routes' `404 title.not_found`, docs/03 sections 3.6 and 7.4).
 */
export async function fetchAdminJson(
  doFetch: typeof fetch,
  url: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; status: number; json: unknown } | { ok: false; failure: AdminFailure }> {
  const bound = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  let text: string | null;
  let status: number;
  try {
    const response = await doFetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      signal: bound,
    });
    status = response.status;
    text = await readCapped(response, MAX_RESPONSE_BYTES);
  } catch {
    return { ok: false, failure: unreachable };
  }
  if (text === null) return { ok: false, failure: badResponse };
  try {
    return { ok: true, status, json: JSON.parse(text) };
  } catch {
    return { ok: false, failure: badResponse };
  }
}

/** The data of a success envelope decoded against a schema; anything else is a bad response. */
export function decodeData<S extends z.ZodTypeAny>(schema: S, json: unknown): AdminResult<z.infer<S>> {
  const envelope = DataEnvelope.safeParse(json);
  const data = envelope.success ? schema.safeParse(envelope.data.data) : null;
  return data?.success ? { ok: true, value: data.data } : { ok: false, failure: badResponse };
}

/** A completed answer outside 2xx, through the one failure vocabulary. */
export function refusalOf(status: number): AdminFailure {
  return status >= 500 ? unreachable : badResponse;
}

/** The dotted code of a completed answer's error envelope, when the backend sent a readable one. */
export function errorCodeOf(json: unknown): string | undefined {
  const parsed = z
    .object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string().optional() }) })
    .safeParse(json);
  return parsed.success ? parsed.data.error.code : undefined;
}

/**
 * The channels and health half of the admin client (`01` section 7). It holds no connection open
 * (docs/03 section 5.1): every call is one request.
 */
export function createAdminClient(options: { fetch?: typeof fetch } = {}): AdminClient {
  const doFetch = options.fetch ?? globalThis.fetch;

  async function get<S extends z.ZodTypeAny>(
    url: string,
    schema: S,
    timeoutMs: number,
    signal: AbortSignal | undefined,
  ): Promise<AdminResult<z.infer<S>>> {
    const answer = await fetchAdminJson(doFetch, url, timeoutMs, signal);
    if (!answer.ok) return { ok: false, failure: answer.failure };
    if (answer.status < 200 || answer.status >= 300) return { ok: false, failure: refusalOf(answer.status) };
    return decodeData(schema, answer.json);
  }

  return {
    health: (baseUrl, signal) => get(`${baseUrl}/healthz`, AnyEnvelope, HEALTH_TIMEOUT_MS, signal),
    channels: (baseUrl, signal) => get(`${baseUrl}/api/channels`, ChannelsSchema, CHANNELS_TIMEOUT_MS, signal),
  };
}
