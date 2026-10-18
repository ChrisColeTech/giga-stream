import { z } from "zod";

/** `PUT /api/channels/:channelId/status`: a hand-set verdict on a stream channel's own address (docs/36 section 8.1). */
export const ChannelStatusSchema = z.object({ status: z.enum(["online", "offline"]) }).strict();
export type ChannelStatusInput = z.infer<typeof ChannelStatusSchema>;
