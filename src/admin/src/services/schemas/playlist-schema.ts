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

/** The list as the service reads it: rows stay `unknown` so one unreadable row costs that row, not the list
 *  (`01` section 8). `services/playlists.ts` parses each with `PlaylistSchema`. */
export const PlaylistListLenientSchema = z.object({ items: z.array(z.unknown()) });

/** `DELETE /api/playlists/:id` (`29` section 9.4): `released` is how many channels it kept as hand-made rows. */
export const PlaylistDeletedSchema = z.object({ id: z.number(), released: z.number() });

export type AdminPlaylist = z.infer<typeof PlaylistSchema>;

/** The readable playlists and how many rows could not be read. */
export interface PlaylistList {
  readonly items: AdminPlaylist[];
  readonly unreadable: number;
}

export type PlaylistDeleted = z.infer<typeof PlaylistDeletedSchema>;
