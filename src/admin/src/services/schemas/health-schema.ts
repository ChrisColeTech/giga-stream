import { z } from "zod";

/* `GET /healthz`, public (`29` sections 5 and 6.3): the backend's facts for the gate and Settings' About. */
export const HealthSchema = z.object({
  role: z.literal("admin-backend"),
  version: z.string(),
  revision: z.number(),
  tmdb: z.enum(["configured", "absent"]),
  liveChannels: z.number(),
});

export type BackendHealth = z.infer<typeof HealthSchema>;
