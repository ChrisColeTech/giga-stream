import { z } from "zod";
import type { AdminChannel } from "@/types/admin-channel";

/* `GET /api/admin-channels` (`29` section 5). A live and a stream row share the base and differ by `kind`. A `number` the backend
 * still sends for an old channel is ignored (owner, 2026-10-17). */
const base = {
  id: z.string(),
  name: z.string(),
  category: z.string(),
  logoUrl: z.string().optional(),
  streamUrl: z.string(),
  tvgId: z.string().optional(),
  source: z.string().optional(),
  revision: z.number(),
  enabled: z.boolean(),
};

const StreamSchema = z.object({
  ...base,
  kind: z.literal("stream"),
  editedFields: z.array(z.string()).optional(),
});

const LiveSchema = z.object({
  ...base,
  kind: z.literal("live"),
  mode: z.enum(["loop", "encode"]),
  captions: z.boolean(),
  variants: z.array(z.enum(["360p", "720p", "1080p"])),
  folder: z.string().optional(),
  videos: z.array(z.string()).optional(),
  state: z.enum(["preparing", "starting", "live", "restarting", "stopped", "failed"]),
  problem: z.string().optional(),
  renditions: z.array(z.string()),
  playlist: z.array(z.object({ name: z.string(), durationMs: z.number() })),
  nowPlaying: z.object({ index: z.number(), name: z.string() }).nullable(),
});

export const ChannelSchema: z.ZodType<AdminChannel> = z.discriminatedUnion("kind", [StreamSchema, LiveSchema]);

export const ChannelListSchema = z.object({ items: z.array(ChannelSchema), revision: z.number() });

/** The list as the service reads it: rows stay `unknown` so one unreadable row costs that row, not the list (`01`
 *  section 8). `services/channels.ts` parses each with `ChannelSchema`. */
export const ChannelListLenientSchema = z.object({ items: z.array(z.unknown()), revision: z.number() });

/** The readable channels, the list's revision, and how many rows could not be read. */
export interface ChannelList {
  readonly items: AdminChannel[];
  readonly revision: number;
  readonly unreadable: number;
}

/** One PAGE of the list (`GET /api/admin-channels?limit=...`, `41` section 3.1): `total` counts the rows after the
 *  filters, before `limit`. Rows stay `unknown`, parsed one by one like the whole list's. */
export const ChannelPageLenientSchema = z.object({
  items: z.array(z.unknown()),
  revision: z.number(),
  total: z.number().int().min(0),
  offset: z.number().int().min(0),
  limit: z.number().int().min(1),
});

/** The readable rows of one page, the list's revision and total, and how many rows could not be read. */
export interface ChannelPage extends ChannelList {
  readonly total: number;
  readonly offset: number;
}

export const DeletedChannelSchema = z.object({ id: z.string() });
