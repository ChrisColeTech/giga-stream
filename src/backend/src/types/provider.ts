import { z } from "zod";

import { ADDRESS_MAX, API_KEY_MAX, PROVIDER_NAME_MAX, SOURCE_MAX } from "../constants/limits.js";

/** A provider as the backend answers it (docs/03 section 7.2b). */
export interface BackendProvider {
  id: number;
  name: string;
  source: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

export interface ProviderList {
  items: BackendProvider[];
}

const text = (max: number) => z.string().trim().min(1).max(max);

/** The fields an operator sets. */
export const ProviderInputSchema = z
  .object({
    name: text(PROVIDER_NAME_MAX),
    source: text(SOURCE_MAX),
    api_key: z.string().trim().max(API_KEY_MAX).optional(),
  })
  .strict();
export type ProviderInput = z.infer<typeof ProviderInputSchema>;

export const ProviderPatchSchema = ProviderInputSchema.partial().strict();
export type ProviderPatch = z.infer<typeof ProviderPatchSchema>;
