import { z } from "zod";

export const SourceSchema = z.object({
  providerId: z.number().int(),
  name: z.string().min(1),
  url: z.string().url(),
  origin: z.string().url(),
  order: z.number().int(),
  startParam: z.string().min(1).optional(),
  subtitlesParam: z.string().min(1).optional(),
  frameOrigins: z.array(z.string().url()).optional(),
  messageShape: z.enum(["vidsrc-status", "player-event"]).optional(),
});

export type TitleSource = z.infer<typeof SourceSchema>;
