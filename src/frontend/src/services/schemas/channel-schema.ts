import { z } from "zod";

export const ChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  logoUrl: z.string().optional(),
  category: z.string(),
  number: z.string().optional(),
  revision: z.number().int().nonnegative(),
  streamUrl: z.string().url(),
});

export const ChannelListSchema = z.object({
  items: z.array(ChannelSchema),
  categories: z.array(z.object({ value: z.string(), count: z.number().int().nonnegative() })),
  revision: z.number().int().nonnegative(),
});

export const LastChannelSchema = z.object({ id: z.string().min(1) });

export type ChannelAnswer = z.infer<typeof ChannelSchema>;
export type ChannelListAnswer = z.infer<typeof ChannelListSchema>;
export type LastChannelAnswer = z.infer<typeof LastChannelSchema>;
