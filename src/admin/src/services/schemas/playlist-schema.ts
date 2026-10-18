import { z } from "zod";

/* `PlaylistView` (`29` section 5): the host is shown, the address is masked, and the secret never arrives. */
export const PlaylistSchema = z.object({
  id: z.number(),
  name: z.string(),
  host: z.string(),
  masked: z.string(),
  enabled: z.boolean(),
  channels: z.number(),
  lastSyncedAt: z.number().optional(),
  lastOutcome: z.string().optional(),
});

export const PlaylistListSchema = z.object({ items: z.array(PlaylistSchema) });

export type AdminPlaylist = z.infer<typeof PlaylistSchema>;
export type PlaylistList = z.infer<typeof PlaylistListSchema>;
