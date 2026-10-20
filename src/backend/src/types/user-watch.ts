import { z } from "zod";

/**
 * The account's watch write and removal shapes (docs/63 section 3.2): the fileserver's `/api/watch` bodies
 * (`src/fileserver/src/routes/watch.ts`) exactly, so the fileserver's browser pass-through forwards a
 * request without translating it. Extra fields ride along, as the fileserver's `.passthrough()` allows.
 * Positions are integer milliseconds (docs/01 section 8), so a float or a negative number is malformed.
 */
export const WatchWriteSchema = z
  .object({
    item: z.object({ kind: z.enum(["title", "local"]), id: z.string().min(1).max(200) }),
    season: z.number().int().positive().optional(),
    episode: z.number().int().positive().optional(),
    positionMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive().optional(),
    playbackId: z.string().min(1).max(200),
    seq: z.number().int().positive(),
  })
  .passthrough();
export type WatchWrite = z.infer<typeof WatchWriteSchema>;

/** `DELETE /watch/:watchId`: the fileserver's `IdParams`, unconstrained as there. */
export const WatchIdParams = z.object({ watchId: z.string() });
