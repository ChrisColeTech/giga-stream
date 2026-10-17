import { z } from "zod";

import { ADDRESS_MAX, FRAME_ORIGINS_MAX, PARAM_MAX, PROVIDER_NAME_MAX, SOURCE_MAX } from "../constants/limits.js";

/** How a provider plays (docs/03 section 7.2b). */
export const PROVIDER_FAMILIES = ["embed", "stream"] as const;
export type ProviderFamily = (typeof PROVIDER_FAMILIES)[number];

/** The player-message shapes the PoC decoded (docs/14 section 2.4). Absent: no documented messages. */
export const MESSAGE_SHAPES = ["vidsrc-status", "player-event"] as const;
export type ProviderMessageShape = (typeof MESSAGE_SHAPES)[number];

/** A provider as the backend answers it (docs/03 section 7.2b). */
export interface BackendProvider {
  id: number;
  name: string;
  source: string;
  is_active: boolean;
  order: number;
  family: ProviderFamily;
  movieTemplate?: string;
  episodeTemplate?: string;
  startParam?: string;
  subtitlesParam?: string;
  origin?: string;
  frameOrigins?: string[];
  messageShape?: ProviderMessageShape;
  created_at: string;
}

/** One source the fileserver's title answers carry (docs/03 sections 3.6 and 7.5). */
export interface TitleSource {
  providerId: number;
  name: string;
  url: string;
  origin: string;
  order: number;
  startParam?: string;
  subtitlesParam?: string;
  frameOrigins?: string[];
  messageShape?: ProviderMessageShape;
}

export interface ProviderList {
  items: BackendProvider[];
}

export interface SeedProvider {
  name: string;
  source: string;
  order: number;
  family: ProviderFamily;
  movieTemplate?: string;
  episodeTemplate?: string;
  startParam?: string;
  subtitlesParam?: string;
  origin?: string;
  frameOrigins?: string[];
  messageShape?: ProviderMessageShape;
}

const text = (max: number) => z.string().trim().min(1).max(max);

/** An https template with the placeholders its kind needs; the refusal names the field. */
const template = (placeholders: readonly string[]) =>
  text(ADDRESS_MAX)
    .regex(/^https:\/\//, "an embed template is an https address")
    .refine((value) => placeholders.every((p) => value.includes(p)), `is missing a placeholder`);

const MOVIE_TEMPLATE_PLACEHOLDERS = ["{tmdbId}"] as const;
const EPISODE_TEMPLATE_PLACEHOLDERS = ["{tmdbId}", "{season}", "{episode}"] as const;

const httpsOrigin = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.pathname === "/" || url.pathname === "");
  } catch {
    return false;
  }
};

const originField = text(ADDRESS_MAX).refine(httpsOrigin, "an origin is an https address with no path");
const paramField = text(PARAM_MAX);

const movieTemplate = template(MOVIE_TEMPLATE_PLACEHOLDERS);
const episodeTemplate = template(EPISODE_TEMPLATE_PLACEHOLDERS);
const frameOriginList = z.array(originField).min(1).max(FRAME_ORIGINS_MAX);
const messageShape = z.enum(MESSAGE_SHAPES);

/** The fields an operator sets (docs/03 section 7.2b). `enabled` is the provider's `is_active`; absent means on. */
export const ProviderInputSchema = z
  .object({
    name: text(PROVIDER_NAME_MAX),
    source: text(SOURCE_MAX),
    order: z.number().int().min(0).optional(),
    family: z.enum(PROVIDER_FAMILIES).default("embed"),
    enabled: z.boolean().optional(),
    movieTemplate: movieTemplate.optional(),
    episodeTemplate: episodeTemplate.optional(),
    startParam: paramField.optional(),
    subtitlesParam: paramField.optional(),
    origin: originField.optional(),
    frameOrigins: frameOriginList.optional(),
    messageShape: messageShape.optional(),
  })
  .strict();
export type ProviderInput = z.infer<typeof ProviderInputSchema>;

/**
 * A PATCH: any field may be absent (it keeps the stored value); `null` clears an optional field, which a PUT could not
 * do before (docs/29 section 9.2, B2).
 */
export const ProviderPatchSchema = ProviderInputSchema.partial()
  .extend({
    movieTemplate: movieTemplate.nullable().optional(),
    episodeTemplate: episodeTemplate.nullable().optional(),
    startParam: paramField.nullable().optional(),
    subtitlesParam: paramField.nullable().optional(),
    origin: originField.nullable().optional(),
    frameOrigins: frameOriginList.nullable().optional(),
    messageShape: messageShape.nullable().optional(),
  })
  .strict();
export type ProviderPatch = z.infer<typeof ProviderPatchSchema>;
