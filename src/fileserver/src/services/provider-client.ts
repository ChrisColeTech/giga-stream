import { z } from "zod";

import type { AdminResult } from "./admin-failure.js";
import { badResponse, unreachable } from "./admin-failure.js";

const ProviderSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  source: z.string(),
  is_active: z.boolean(),
  order: z.number().int(),
  family: z.enum(["embed", "stream"]),
  movieTemplate: z.string().optional(),
  episodeTemplate: z.string().optional(),
  startParam: z.string().optional(),
  subtitlesParam: z.string().optional(),
  origin: z.string().optional(),
  frameOrigins: z.array(z.string()).optional(),
  messageShape: z.enum(["vidsrc-status", "player-event"]).optional(),
  created_at: z.string(),
});
const EnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z.object({ items: z.array(ProviderSchema) }),
});
const MAX_BYTES = 1024 * 1024;

export type Provider = z.infer<typeof ProviderSchema>;

export interface ProviderClient {
  /** The sole permitted request to the admin API (docs/64 section 1). */
  list(baseUrl: string): Promise<AdminResult<Provider[]>>;
}

export function createProviderClient(options: { fetch?: typeof fetch } = {}): ProviderClient {
  const doFetch = options.fetch ?? globalThis.fetch;
  return {
    async list(baseUrl) {
      let response: Response;
      try {
        response = await doFetch(`${baseUrl.replace(/\/$/, "")}/api/admin/providers`, {
          method: "GET",
          headers: { accept: "application/json" },
          credentials: "omit",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        return { ok: false, failure: unreachable };
      }
      if (!response.ok) return { ok: false, failure: response.status >= 500 ? unreachable : badResponse };
      try {
        const text = await response.text();
        if (Buffer.byteLength(text) > MAX_BYTES) return { ok: false, failure: badResponse };
        const parsed = EnvelopeSchema.safeParse(JSON.parse(text) as unknown);
        return parsed.success ? { ok: true, value: parsed.data.data.items } : { ok: false, failure: badResponse };
      } catch {
        return { ok: false, failure: badResponse };
      }
    },
  };
}
