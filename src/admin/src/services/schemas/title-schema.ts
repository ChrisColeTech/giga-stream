import { z } from "zod";

/* `AdminTitleRow` and the detail's extra fields (`29` section 5). A season is a count in a list row and the episodes in a
 * detail. `sources` items are the title overlay's own; the page that draws them narrows them. */
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
});

export const TitleDetailSchema = TitleRowSchema.extend({
  plot: z.string().optional(),
  cast: z.array(z.string()).optional(),
  runtimeMs: z.number().optional(),
  seasons: z
    .array(z.object({ season: z.number(), episodeCount: z.number().optional(), episodes: z.array(z.unknown()).optional() }))
    .optional(),
  sources: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const TitleListSchema = z.object({
  items: z.array(TitleRowSchema),
  page: z.number(),
  totalPages: z.number(),
  totalResults: z.number(),
});

export type AdminTitleRow = z.infer<typeof TitleRowSchema>;
export type AdminTitleDetail = z.infer<typeof TitleDetailSchema>;
export type TitleList = z.infer<typeof TitleListSchema>;
