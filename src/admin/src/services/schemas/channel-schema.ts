import { z } from "zod";
import type { AdminChannel } from "@/types/admin-channel";

/* `GET /api/admin-channels` (`29` section 5). A live and a stream row share the base and differ by `kind`. The number is
 * text on the wire; a number is accepted and read as text. */
const text = z.union([z.string(), z.number()]).transform(String);
const base = {
  id: z.string(),
  name: z.string(),
  category: z.string(),
  number: text.optional(),
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
  fault: z.enum(["stall", "segment-404", "slow-segments", "playlist-500", "discontinuity", "restart", "end"]).nullable(),
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

const FAULT = z.enum(["stall", "segment-404", "slow-segments", "playlist-500", "discontinuity", "restart", "end"]);

/** `PUT|DELETE /api/channels/:id/fault`. The backend answers the applied fault as `{ fault, expiresInMs }` (or the bare
 *  word, or null once cleared); either reads as the fault's name. */
export const FaultAnswerSchema = z
  .object({ id: z.string(), fault: z.union([FAULT, z.object({ fault: FAULT }), z.null()]) })
  .transform((answer) => ({
    id: answer.id,
    fault: answer.fault === null || typeof answer.fault === "string" ? answer.fault : answer.fault.fault,
  }));

export const DeletedChannelSchema = z.object({ id: z.string() });
