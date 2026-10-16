import { z } from "zod";

import type { AppErrorCode } from "../types/envelope.js";

export const HEALTH_TIMEOUT_MS = 5_000;
export const CHANNELS_TIMEOUT_MS = 20_000;
/** A page larger than this is refused rather than buffered. */
export const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

export interface AdminFailure {
  code: Extract<AppErrorCode, "backend.unreachable" | "backend.bad_response">;
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

const unreachable: AdminFailure = {
  code: "backend.unreachable",
  message: "The admin backend did not answer.",
  status: 503,
};
const badResponse: AdminFailure = {
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
 * The only caller of the admin backend (`01` section 7). It sends no cookie and no credential,
 * follows no redirect, bounds every call by a timeout and the body by a size cap, and decodes with
 * Zod. It holds no connection open (docs/03 section 5.1): every call is one request.
 */
export function createAdminClient(options: { fetch?: typeof fetch } = {}): AdminClient {
  const doFetch = options.fetch ?? globalThis.fetch;

  async function get<S extends z.ZodTypeAny>(
    url: string,
    schema: S,
    timeoutMs: number,
    signal: AbortSignal | undefined,
  ): Promise<AdminResult<z.infer<S>>> {
    const bound = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    let text: string | null;
    try {
      const response = await doFetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        signal: bound,
      });
      if (!response.ok) {
        await response.body?.cancel();
        return { ok: false, failure: response.status >= 500 ? unreachable : badResponse };
      }
      text = await readCapped(response, MAX_RESPONSE_BYTES);
    } catch {
      return { ok: false, failure: unreachable };
    }
    if (text === null) return { ok: false, failure: badResponse };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, failure: badResponse };
    }
    const envelope = DataEnvelope.safeParse(json);
    const data = envelope.success ? schema.safeParse(envelope.data.data) : null;
    return data?.success ? { ok: true, value: data.data } : { ok: false, failure: badResponse };
  }

  return {
    health: (baseUrl, signal) => get(`${baseUrl}/healthz`, AnyEnvelope, HEALTH_TIMEOUT_MS, signal),
    channels: (baseUrl, signal) => get(`${baseUrl}/api/channels`, ChannelsSchema, CHANNELS_TIMEOUT_MS, signal),
  };
}
