import { z } from "zod";
import { ImageUrlSchema, LibraryItemSchema } from "./library-schema";
import { SourceSchema } from "./source-schema";

export const TitleSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["movie", "tv"]),
  title: z.string().min(1),
  year: z.number().int().optional(),
  plot: z.string().optional(),
  rating: z.number().min(0).max(10).optional(),
  genres: z.array(z.string()),
  cast: z.array(z.string()).max(10),
  runtimeMs: z.number().int().positive().optional(),
  seasons: z.array(z.object({ season: z.number().int(), episodeCount: z.number().int().nonnegative() })).optional(),
  posterUrl: ImageUrlSchema.optional(),
  backdropUrl: ImageUrlSchema.optional(),
  streamUrl: z.string().url().optional(),
  sources: z.array(SourceSchema).optional(),
  /** Answered from the fileserver's cache while the backend could not give the live detail: no sources (`46` A). */
  fromCache: z.literal(true).optional(),
});

export type Title = z.infer<typeof TitleSchema>;

export const EpisodeSchema = z.object({
  season: z.number().int().positive(),
  episode: z.number().int().positive(),
  title: z.string().optional(),
  airDate: z.string().optional(),
  runtimeMs: z.number().int().positive().optional(),
  stillUrl: ImageUrlSchema.optional(),
  streamUrl: z.string().url().optional(),
  sources: z.array(SourceSchema).optional(),
});

export const SeasonSchema = z.object({ episodes: z.array(EpisodeSchema) });
export const RelatedSchema = z.object({
  basis: z.enum(["tmdb", "genre-year", "genre", "year"]),
  items: z.array(LibraryItemSchema),
});
