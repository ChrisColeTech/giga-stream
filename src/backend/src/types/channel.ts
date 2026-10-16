import { z } from "zod";

import { ADDRESS_MAX, CHANNEL_CATEGORY_MAX, CHANNEL_NAME_MAX, CHANNEL_NUMBER_MAX } from "../constants/limits.js";

/** A channel as the backend answers it (docs/03 section 7.2). */
export interface BackendChannel {
  id: string;
  name: string;
  category: string;
  number?: string;
  logoUrl?: string;
  streamUrl: string;
  revision: number;
}

export interface ChannelList {
  items: BackendChannel[];
  revision: number;
}

const text = (max: number) => z.string().trim().min(1).max(max);

/** The fields an operator sets; the address rule (section 7.3) is checked by the service, not here. */
export const ChannelInputSchema = z
  .object({
    name: text(CHANNEL_NAME_MAX),
    category: text(CHANNEL_CATEGORY_MAX),
    number: text(CHANNEL_NUMBER_MAX).optional(),
    logoUrl: z.string().max(ADDRESS_MAX).optional(),
    streamUrl: z.string().min(1).max(ADDRESS_MAX),
  })
  .strict();
export type ChannelInput = z.infer<typeof ChannelInputSchema>;

export const ChannelPatchSchema = ChannelInputSchema.partial().strict();
export type ChannelPatch = z.infer<typeof ChannelPatchSchema>;
