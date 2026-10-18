import type { LiveCategory, LiveMode, Variant } from "@/types/admin-channel";

/* The Channels tab's words and option lists (`28` sections 7.2 and 7.3, `36`): labels (also the `labelColumn` lists),
 * the rail's sections, what the pickers offer, the sentences a disabled control gives as its reason, and the notices.
 * Tooltips on info glyphs are in `channel-tips.ts`. */

export const CATEGORIES: readonly LiveCategory[] = ["News", "Sports", "Music", "Kids", "Movies", "Entertainment"];
export const VARIANTS: readonly Variant[] = ["360p", "720p", "1080p"];
export const MODE_LABEL: Readonly<Record<LiveMode, string>> = { loop: "Loop", encode: "Encode" };

/** The least number of qualities a channel keeps. */
export const MIN_VARIANTS = 2;
export const MIN_VARIANTS_REASON = "A channel keeps at least two qualities.";

/** The labels each page's rows carry, so a page fixes its label column once. Name first on every form. */
export const NEW_CHANNEL_LABELS = ["Name", "Kind", "Category", "Folder", "Stream address"] as const;
export const CHANNEL_LABELS = [
  ...NEW_CHANNEL_LABELS,
  "Plays",
  "Videos",
  "Enabled",
  "Logo",
  "Logo address",
  "Id",
  "Mode",
  "Captions",
  "Qualities",
  "State",
  "Problem",
  "Renditions",
  "Playlist",
  "Synced from",
  "Revision",
] as const;

/** The rail's sections; the ids are the groups' ids, prefixed by the page (`lv-`, `st-`). A module constant: a new array
 *  every render would re-bind the scroll spy's listener. */
export const LIVE_SECTIONS = [
  { id: "lv-details", label: "Details" },
  { id: "lv-playback", label: "Playback" },
  { id: "lv-status", label: "Status" },
] as const;
export const STREAM_SECTIONS = [
  { id: "st-details", label: "Details" },
  { id: "st-stream", label: "Stream" },
  { id: "st-status", label: "Status" },
] as const;
export const LIVE_SECTION_IDS: readonly string[] = LIVE_SECTIONS.map((section) => section.id);
export const STREAM_SECTION_IDS: readonly string[] = STREAM_SECTIONS.map((section) => section.id);

/** Tooltips at rest and disabled reasons (shown as the control's tooltip). */
export const DELETE_SYNCED_TIP = "The next sync adds it again. Disable it to keep it off.";
export const REBUILD_DISABLED = "Enable the channel to rebuild it.";
export const STREAM_NO_REBUILD = "A stream channel has nothing to rebuild.";
export const REVERT_HAND_MADE = "This channel was made by hand; there is nothing to revert.";
export const REVERT_NONE = "Nothing was edited.";
export const CHOOSE_UNAVAILABLE = "Folders can be chosen only in the backend's own window; type the path.";
export const ADD_VIDEO_EMPTY = "Type a path first.";
export const ADD_VIDEO_DUPLICATE = "That video is already in the list.";
export const ALREADY_FIRST = "Already first";
export const ALREADY_LAST = "Already last";
export const UNREACHABLE_REASON = "The admin backend cannot be reached.";
export const SAVING_REASON = "Saving.";
export const LOADING_REASON = "Loading.";
export const WORKING_REASON = "Working.";

/** Refusals shown under a row. */
export const fieldRequired = (label: string): string => `${label} is required.`;

/** The toolbar's bulk verbs (`36` section 5.3). */
export const ALREADY_ENABLED = "Already enabled.";
export const ALREADY_DISABLED = "Already disabled.";
export const ALL_ENABLED = "Every ticked channel is already enabled.";
export const ALL_DISABLED = "Every ticked channel is already disabled.";
export const bulkDeleteQuestion = (count: number): string => `Delete ${count} ${count === 1 ? "channel" : "channels"}?`;

/** Notices. A local path is never part of one (`36` section 10). */
export const channelPreparing = (name: string): string => `${name} is preparing.`;
export const channelCreated = (name: string): string => `Created ${name}.`;
export const channelSaved = (name: string): string => `Saved ${name}.`;
export const channelDeleted = (name: string): string => `Deleted ${name}.`;
export const channelReverted = (name: string): string => `Reverted ${name}.`;
export const unreadableChannels = (count: number): string =>
  `${count} ${count === 1 ? "channel" : "channels"} could not be read.`;
export const CHANNEL_GONE = "That channel no longer exists.";
export const REQUEST_FAILED = "The request failed.";
export const ADDRESS_COPIED = "Address copied.";
export const ADDRESS_NOT_COPIED = "The address could not be copied.";
