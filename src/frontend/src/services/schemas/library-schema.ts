import { z } from "zod";

export const ItemRefSchema = z.object({ kind: z.enum(["title", "local"]), id: z.string().min(1) });

export const LibraryItemSchema = z.object({
  ref: ItemRefSchema,
  watchId: z.string().optional(),
  kind: z.enum(["movie", "tv", "local"]),
  title: z.string().min(1),
  year: z.number().int().optional(),
  posterUrl: z.string().optional(),
  quality: z.string().optional(),
  genres: z.array(z.string()),
  favorite: z.boolean(),
  progress: z
    .object({
      positionMs: z.number().int().nonnegative(),
      durationMs: z.number().int().positive().optional(),
      state: z.enum(["watching", "watched"]),
      season: z.number().int().positive().optional(),
      episode: z.number().int().positive().optional(),
    })
    .optional(),
});

export const LibraryPageSchema = z.object({
  items: z.array(LibraryItemSchema),
  total: z.number().int().nonnegative().optional(),
  nextCursor: z.string().optional(),
  facets: z.object({ genres: z.array(z.string()), years: z.array(z.number().int()) }),
  trending: z.boolean(),
  titlesAvailable: z.boolean(),
});

export const ContinuePageSchema = z.object({ items: z.array(LibraryItemSchema) });
