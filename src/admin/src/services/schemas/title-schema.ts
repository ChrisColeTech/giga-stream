import { z } from "zod";

/* `AdminTitleRow` and the detail's extra fields (`29` section 5). A season is a count in a list row and the episodes in
 * a detail. `sources` items are the title overlay's own; the page that draws them narrows them. `editedFields` is on an
 * admin's read (B5): the fields an admin changed on a synced title. */
export const TitleRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["movie", "tv"]),
  title: z.string(),
  year: z.number().optional(),
  rating: z.number().optional(),
  genres: z.array(z.string()).optional(),
  posterUrl: z.string().optional(),
  backdropUrl: z.string().optional(),
  tmdbId: z.number().optional(),
  streamUrl: z.string().optional(),
  state: z.enum(["synced", "edited", "manual"]),
  enabled: z.boolean().optional(),
  editedFields: z.array(z.string()).optional(),
  /** Browse TMDB rows only (`docs/47` section 3.3): the store holds this TMDB title / the admin deleted it. */
  stored: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export const EpisodeSchema = z.object({
  episode: z.number(),
  title: z.string().optional(),
  airDate: z.string().optional(),
  runtimeMs: z.number().optional(),
  stillUrl: z.string().optional(),
  streamUrl: z.string().optional(),
});

export const SeasonSchema = z.object({
  season: z.number(),
  episodeCount: z.number().optional(),
  episodes: z.array(z.unknown()).optional(),
});

export const SourceSchema = z.object({
  providerId: z.number().optional(),
  name: z.string(),
  url: z.string(),
  origin: z.string().optional(),
  order: z.number().optional(),
});

export const TitleDetailSchema = TitleRowSchema.extend({
  plot: z.string().optional(),
  cast: z.array(z.string()).optional(),
  runtimeMs: z.number().optional(),
  seasons: z.array(SeasonSchema).optional(),
  sources: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const TitleListSchema = z.object({
  items: z.array(TitleRowSchema),
  page: z.number(),
  totalPages: z.number(),
  totalResults: z.number(),
});

/** The list as the service reads it: rows stay `unknown` so one unreadable row costs that row, not the page. */
export const TitleListLenientSchema = z.object({
  items: z.array(z.unknown()),
  page: z.number(),
  totalPages: z.number(),
  totalResults: z.number(),
});

export const TitleDeletedSchema = z.object({ id: z.string() });

/** A deleted synced title (`GET /api/titles/deleted`): its TMDB identity, the last known title text if one was kept,
 *  and when it was deleted. A restore answers `{ id }` like a delete. */
export const DeletedTitleSchema = z.object({
  id: z.string(),
  kind: z.enum(["movie", "tv"]),
  tmdbId: z.number(),
  title: z.string().optional(),
  deletedAt: z.number(),
});
export const DeletedTitleListSchema = z.object({ items: z.array(DeletedTitleSchema) });
export type AdminDeletedTitle = z.infer<typeof DeletedTitleSchema>;

export type AdminTitleRow = z.infer<typeof TitleRowSchema>;
export type AdminTitleDetail = z.infer<typeof TitleDetailSchema>;
export type TitleEpisode = z.infer<typeof EpisodeSchema>;
export type TitleSource = z.infer<typeof SourceSchema>;

/** One page of titles as the service answers it, with how many rows could not be read. */
export interface TitleList {
  readonly items: AdminTitleRow[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalResults: number;
  readonly unreadable: number;
}
