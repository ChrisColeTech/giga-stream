import { z } from "zod";
import { ItemRefSchema } from "./library-schema";

export const WatchEntrySchema = z.object({
  watchId: z.string().min(1),
  item: ItemRefSchema,
  season: z.number().int().positive().optional(),
  episode: z.number().int().positive().optional(),
  positionMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().optional(),
  state: z.enum(["watching", "watched"]),
  updatedAt: z.number().int().nonnegative(),
});

export const WatchWriteSchema = z.object({
  item: ItemRefSchema,
  season: z.number().int().positive().optional(),
  episode: z.number().int().positive().optional(),
  positionMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().optional(),
  playbackId: z.string().min(1),
  seq: z.number().int().positive(),
});

export const WatchWriteAnswerSchema = z.object({ applied: z.boolean(), entry: WatchEntrySchema.nullable() });
export const RemovedWatchSchema = z.object({ removed: z.string().min(1) });
export const ClearedWatchSchema = z.object({ cleared: z.number().int().nonnegative() });
