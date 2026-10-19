import { z } from "zod";

import { CHANNEL_BULK_MAX } from "../constants/limits.js";

/** `PATCH /api/admin/channels`: one switch for up to 5,000 ids (docs/43 section 3.3). */
export const ChannelBulkSchema = z
  .object({ enabled: z.boolean(), ids: z.array(z.string().min(1).max(200)).min(1).max(CHANNEL_BULK_MAX) })
  .strict();
export type ChannelBulk = z.infer<typeof ChannelBulkSchema>;

export interface ChannelBulkResult {
  changed: number;
  unchanged: number;
  skipped: number;
}
