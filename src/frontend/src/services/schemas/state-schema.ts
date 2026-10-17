import { z } from "zod";
import { ChannelListSchema } from "./channel-schema";
import { CollectionListSchema } from "./collection-schema";
import { JobListSchema } from "./job-schema";
import { SettingsSchema } from "./settings-schema";

export const ShellStateSchema = z.object({
  activeSurface: z.enum(["live", "library", "player"]),
  paneVisibility: z.record(z.string(), z.boolean()),
  paneSizes: z.record(z.string(), z.array(z.number().finite()).min(1).max(8)),
  window: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().positive(),
      height: z.number().positive(),
      maximized: z.boolean(),
    })
    .optional(),
});

export const StateWireSchema = z.record(z.string(), z.unknown());
export const StatePartSchemas = {
  version: z.string().min(1),
  host: z.object({ runtime: z.enum(["electron", "browser"]) }),
  settings: SettingsSchema,
  shell: ShellStateSchema,
  backend: z.object({
    connected: z.boolean(),
    revision: z.number().int().optional(),
    readAt: z.number().int().nonnegative().optional(),
    error: z.object({ code: z.string(), message: z.string() }).optional(),
  }),
  channels: ChannelListSchema,
  lastChannelId: z.string().optional(),
  collections: CollectionListSchema,
  jobs: JobListSchema,
} as const;
