import { z } from "zod";

import { ADDRESS_MAX } from "../constants/limits.js";

const NAME_MAX = 120;
const name = z.string().trim().min(1).max(NAME_MAX);
const address = z.string().trim().min(1).max(ADDRESS_MAX);

/** `POST /api/playlists`: the name defaults to the address's host. The address rule is checked by the service. */
export const PlaylistInputSchema = z
  .object({ name: name.optional(), address, enabled: z.boolean().optional() })
  .strict();
export type PlaylistInput = z.infer<typeof PlaylistInputSchema>;

/** `PATCH /api/playlists/:id`: any field; an `address` replaces the stored one. */
export const PlaylistPatchSchema = z
  .object({ name: name.optional(), address: address.optional(), enabled: z.boolean().optional() })
  .strict();
export type PlaylistPatch = z.infer<typeof PlaylistPatchSchema>;

/** A playlist as a read answers it (docs/26 section 3.11): never its address, only its host and a masked form. */
export interface PlaylistView {
  id: number;
  name: string;
  host: string;
  masked: string;
  enabled: boolean;
  /** How many channels it created or last updated. */
  channels: number;
  lastSyncedAt?: number;
  lastOutcome?: string;
}
