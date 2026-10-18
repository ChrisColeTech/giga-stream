import { z } from "zod";

/* `BackendProvider` (`29` section 5); `is_active` and `created_at` are the backend's own snake_case. */
export const MESSAGE_SHAPES = ["vidsrc-status", "player-event"] as const;
export const PROVIDER_FAMILIES = ["embed", "stream"] as const;

export const ProviderSchema = z.object({
  id: z.number(),
  name: z.string(),
  source: z.string(),
  is_active: z.boolean(),
  order: z.number(),
  family: z.enum(PROVIDER_FAMILIES),
  movieTemplate: z.string().optional(),
  episodeTemplate: z.string().optional(),
  startParam: z.string().optional(),
  subtitlesParam: z.string().optional(),
  origin: z.string().optional(),
  frameOrigins: z.array(z.string()).optional(),
  messageShape: z.enum(MESSAGE_SHAPES).optional(),
  created_at: z.string(),
});

export const ProviderListSchema = z.object({ items: z.array(ProviderSchema) });

/** The list as the service reads it: rows stay `unknown` so one unreadable row costs that row, not the list
 *  (`01` section 8). `services/providers.ts` parses each with `ProviderSchema`. */
export const ProviderListLenientSchema = z.object({ items: z.array(z.unknown()) });

export const ProviderDeletedSchema = z.object({ id: z.number() });

export type AdminProvider = z.infer<typeof ProviderSchema>;
export type ProviderFamily = AdminProvider["family"];
export type MessageShape = NonNullable<AdminProvider["messageShape"]>;

/** The readable providers and how many rows could not be read. */
export interface ProviderList {
  readonly items: AdminProvider[];
  readonly unreadable: number;
}
