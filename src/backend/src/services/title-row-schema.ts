import { z } from "zod";

/** Cached public title fields must remain readable by the fileserver after a restart. */
export const StoredTitleSchema = z.object({
  id: z.string().min(1),
  tmdbId: z.number().int().positive(),
  kind: z.enum(["movie", "tv"]),
  title: z.string().trim().min(1),
  genres: z.array(z.string()),
  shape: z.enum(["list", "detail"]),
  year: z.number().int().optional(),
  rating: z.number().min(0).max(10).optional(),
  posterUrl: z.string().url().optional(),
  backdropUrl: z.string().url().optional(),
  plot: z.string().optional(),
  cast: z.array(z.string()).optional(),
  runtimeMs: z.number().nonnegative().optional(),
  popularity: z.object({ score: z.number(), readAt: z.number() }).optional(),
}).passthrough();
