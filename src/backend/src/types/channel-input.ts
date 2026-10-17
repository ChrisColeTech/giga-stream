import path from "node:path";
import { z } from "zod";

import {
  ADDRESS_MAX,
  CHANNEL_CATEGORY_MAX,
  CHANNEL_NAME_MAX,
  CHANNEL_NUMBER_MAX,
  CHANNEL_VIDEOS_MAX,
  LIVE_ID_MAX,
  LIVE_NUMBER_MAX,
  LIVE_NUMBER_MIN,
  PATH_MAX,
} from "../constants/limits.js";
import { LIVE_CATEGORIES, LIVE_MODES, VARIANT_NAMES, VARIANTS_MIN } from "../constants/live-media.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const absolutePath = z
  .string()
  .trim()
  .min(1)
  .max(PATH_MAX)
  .refine((value) => path.isAbsolute(value), "must be an absolute path");
const variants = z
  .array(z.enum(VARIANT_NAMES))
  .min(VARIANTS_MIN)
  .refine((list) => new Set(list).size === list.length, "must not repeat");
const videos = z.array(absolutePath).min(1).max(CHANNEL_VIDEOS_MAX);
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DIGITS = /^\d{1,4}$/;

/** A live number: a whole 1 to 9999, sent as digits or an integer, and kept as text (the wire's `number`). */
export const LiveNumberSchema = z.union([z.number(), z.string().trim()]).transform((value, ctx) => {
  const whole = typeof value === "number" ? value : DIGITS.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(whole) || whole < LIVE_NUMBER_MIN || whole > LIVE_NUMBER_MAX) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `must be a whole number from ${LIVE_NUMBER_MIN} to ${LIVE_NUMBER_MAX}` });
    return z.NEVER;
  }
  return String(whole);
});

/** The fields an operator sets on a stream row; the address rule (section 7.3) is checked by the service. */
const StreamInputSchema = z
  .object({
    kind: z.literal("stream"),
    name: text(CHANNEL_NAME_MAX),
    category: text(CHANNEL_CATEGORY_MAX),
    number: text(CHANNEL_NUMBER_MAX).optional(),
    logoUrl: z.string().max(ADDRESS_MAX).optional(),
    streamUrl: z.string().min(1).max(ADDRESS_MAX),
  })
  .strict();

/** A new live channel: `mode`, `captions` and `variants` have defaults; the source is a folder or a list. */
const LiveInputSchema = z
  .object({
    kind: z.literal("live"),
    id: z.string().regex(KEBAB_CASE, "must be kebab-case").max(LIVE_ID_MAX),
    name: text(CHANNEL_NAME_MAX),
    category: z.enum(LIVE_CATEGORIES),
    number: LiveNumberSchema,
    mode: z.enum(LIVE_MODES).optional(),
    captions: z.boolean().optional(),
    variants: variants.optional(),
    folder: absolutePath.optional(),
    videos: videos.optional(),
  })
  .strict();

/** A body without a `kind` is a stream row, as every body was before live channels (docs/03 section 7.2). */
const withDefaultKind = (value: unknown): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !("kind" in value)
    ? { ...value, kind: "stream" }
    : value;

export const ChannelInputSchema = z
  .preprocess(withDefaultKind, z.discriminatedUnion("kind", [StreamInputSchema, LiveInputSchema]))
  .superRefine((input, ctx) => {
    if (input.kind === "live" && (input.folder === undefined) === (input.videos === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "give either a folder or a list of videos", path: ["folder"] });
    }
  });
export type ChannelInput = z.infer<typeof ChannelInputSchema>;
export type StreamChannelInput = Extract<ChannelInput, { kind: "stream" }>;
export type LiveChannelInput = Extract<ChannelInput, { kind: "live" }>;

/**
 * A change: any field but the id. `kind` is optional and, when given, must be the row's own. Which fields a
 * row accepts depends on its kind, so the service checks them against the stored row; a new `folder` replaces
 * `videos` and the other way round.
 */
export const ChannelPatchSchema = z
  .object({
    kind: z.enum(["stream", "live"]).optional(),
    name: text(CHANNEL_NAME_MAX).optional(),
    category: text(CHANNEL_CATEGORY_MAX).optional(),
    number: z.union([text(CHANNEL_NUMBER_MAX), z.number().int()]).optional(),
    logoUrl: z.string().max(ADDRESS_MAX).optional(),
    streamUrl: z.string().min(1).max(ADDRESS_MAX).optional(),
    mode: z.enum(LIVE_MODES).optional(),
    captions: z.boolean().optional(),
    variants: variants.optional(),
    folder: absolutePath.optional(),
    videos: videos.optional(),
  })
  .strict()
  .refine((patch) => patch.folder === undefined || patch.videos === undefined, {
    message: "give either a folder or a list of videos",
    path: ["folder"],
  });
export type ChannelPatch = z.infer<typeof ChannelPatchSchema>;
