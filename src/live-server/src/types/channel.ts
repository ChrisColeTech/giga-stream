import path from "node:path";
import { z } from "zod";

import { CHANNEL_ID_MAX, CHANNEL_NAME_MAX, CHANNEL_NUMBER_MAX, CHANNEL_VIDEOS_MAX, PATH_MAX } from "../constants/limits.ts";
import { CATEGORIES, MODES, VARIANT_NAMES, type VariantName } from "../constants/media.ts";

export type Category = (typeof CATEGORIES)[number];
export type Mode = (typeof MODES)[number];

/**
 * A channel as stored: what it is called, how it is encoded, and what it plays — every playable video in
 * `folder`, or the `videos` listed, in order (exactly one of the two).
 */
export interface Channel {
  id: string;
  name: string;
  category: Category;
  number: number;
  mode: Mode;
  captions: boolean;
  variants: VariantName[];
  folder?: string;
  videos?: string[];
  createdAt: number;
  updatedAt: number;
}

/** One video of a running channel's playlist. */
export interface PlaylistEntry {
  name: string;
  durationMs: number;
}

export type ChannelState = "preparing" | "starting" | "live" | "restarting" | "stopped" | "failed";

/** A channel as the routes answer it: the stored fields and what it is doing now. */
export interface ChannelView extends Omit<Channel, "createdAt" | "updatedAt"> {
  masterUrl: string;
  logoUrl: string;
  state: ChannelState;
  /** Why the channel is `failed`, in one sentence. */
  problem?: string;
  fault: string | null;
  renditions: string[];
  playlist: PlaylistEntry[];
  nowPlaying: { index: number; name: string } | null;
}

const text = (max: number) => z.string().trim().min(1).max(max);
const absolutePath = z
  .string()
  .trim()
  .min(1)
  .max(PATH_MAX)
  .refine((value) => path.isAbsolute(value), "must be an absolute path");

const editable = {
  name: text(CHANNEL_NAME_MAX),
  category: z.enum(CATEGORIES),
  number: z.number().int().min(1).max(CHANNEL_NUMBER_MAX),
  mode: z.enum(MODES),
  captions: z.boolean(),
  variants: z
    .array(z.enum(VARIANT_NAMES))
    .min(2)
    .refine((list) => new Set(list).size === list.length, "must not repeat"),
  folder: absolutePath,
  videos: z.array(absolutePath).min(1).max(CHANNEL_VIDEOS_MAX),
};

/** A new channel. `mode`, `captions` and `variants` have defaults; the source is a folder or a list. */
export const ChannelInputSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case").max(CHANNEL_ID_MAX),
    ...editable,
    mode: editable.mode.optional(),
    captions: editable.captions.optional(),
    variants: editable.variants.optional(),
    folder: editable.folder.optional(),
    videos: editable.videos.optional(),
  })
  .strict()
  .refine((input) => (input.folder === undefined) !== (input.videos === undefined), {
    message: "give either a folder or a list of videos",
    path: ["folder"],
  });
export type ChannelInput = z.infer<typeof ChannelInputSchema>;

/** A change: any field but the id. Giving `folder` replaces `videos` and the other way round. */
export const ChannelPatchSchema = z
  .object(editable)
  .partial()
  .strict()
  .refine((patch) => patch.folder === undefined || patch.videos === undefined, {
    message: "give either a folder or a list of videos",
    path: ["folder"],
  });
export type ChannelPatch = z.infer<typeof ChannelPatchSchema>;
