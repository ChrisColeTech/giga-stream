import { z } from "zod";

/* `BackendProvider` (`29` section 5); `is_active` and `created_at` are the backend's own snake_case. */
export const ProviderSchema = z.object({
  id: z.number(),
  name: z.string(),
  source: z.string(),
  is_active: z.boolean(),
  order: z.number(),
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

export const ProviderListSchema = z.object({ items: z.array(ProviderSchema) });

export type AdminProvider = z.infer<typeof ProviderSchema>;
export type ProviderList = z.infer<typeof ProviderListSchema>;
