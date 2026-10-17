import { statSync } from "node:fs";
import { z } from "zod";

import { DEFAULT_LIVE_MODE, DEFAULT_VARIANTS, LIVE_CATEGORIES } from "../constants/live-media.js";
import type { LiveRecord, LiveSettings } from "../types/channel.js";
import { type ChannelPatch, type LiveChannelInput, LiveNumberSchema } from "../types/channel-input.js";
import { invalid } from "./stream-channel-rules.js";

const isDirectory = (file: string) => statSync(file, { throwIfNoEntry: false })?.isDirectory() ?? false;
const isFile = (file: string) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
const LiveCategory = z.enum(LIVE_CATEGORIES);
const STREAM_ONLY = ["streamUrl", "logoUrl"] as const;

/** A new live row: defaults for mode, captions and variants; it stores no address (it is built at read time). */
export function newLiveRecord(input: LiveChannelInput): LiveRecord {
  return {
    kind: "live",
    id: input.id,
    name: input.name,
    category: input.category,
    number: input.number,
    logoUrl: null,
    revision: 0,
    enabled: true,
    live: {
      mode: input.mode ?? DEFAULT_LIVE_MODE,
      captions: input.captions ?? false,
      variants: input.variants ?? DEFAULT_VARIANTS,
      folder: input.folder ?? null,
      videos: input.videos ?? [],
    },
  };
}

/** A change to a live row. A new source replaces the old one; otherwise the old one stays. */
export function patchedLiveRecord(current: LiveRecord, patch: ChannelPatch): LiveRecord {
  for (const field of STREAM_ONLY) {
    if (patch[field] !== undefined) throw invalid(field, `A live channel has no ${field}: its address is the backend's own.`);
  }
  if (patch.category !== undefined && !LiveCategory.safeParse(patch.category).success) {
    throw invalid("category", `The category must be one of ${LIVE_CATEGORIES.join(", ")}.`);
  }
  const number = patch.number === undefined ? undefined : LiveNumberSchema.safeParse(patch.number);
  if (number && !number.success) throw invalid("number", "The number must be a whole number from 1 to 9999.");
  const newSource = patch.folder !== undefined || patch.videos !== undefined;
  const live: LiveSettings = {
    mode: patch.mode ?? current.live.mode,
    captions: patch.captions ?? current.live.captions,
    variants: patch.variants ?? current.live.variants,
    folder: newSource ? (patch.folder ?? null) : current.live.folder,
    videos: newSource ? (patch.videos ?? []) : current.live.videos,
  };
  return {
    ...current,
    name: patch.name ?? current.name,
    category: patch.category ?? current.category,
    number: number?.data ?? current.number,
    live,
  };
}

/** What can be checked at once, so a bad path is refused instead of saved as a failing channel. */
export function checkLiveSource(live: LiveSettings): void {
  if (live.folder !== null && !isDirectory(live.folder)) throw invalid("folder", "That folder does not exist.");
  const missing = live.videos.findIndex((file) => !isFile(file));
  if (missing !== -1) throw invalid(`videos.${missing}`, `${live.videos[missing]} does not exist.`);
}
