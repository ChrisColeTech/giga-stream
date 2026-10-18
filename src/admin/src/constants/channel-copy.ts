import type { FaultName, LiveCategory, LiveMode, Variant } from "@/types/admin-channel";

/* The Channels tab's words and option lists (`28` sections 7.2 and 7.3): labels (also the `labelColumn` lists), the
 * rail's sections, what the pickers offer, and the sentences a disabled control gives as its reason. Tooltips on info
 * glyphs are in `channel-tips.ts`. */

export const CATEGORIES: readonly LiveCategory[] = ["News", "Sports", "Music", "Kids", "Movies", "Entertainment"];
export const FAULTS: readonly FaultName[] = [
  "stall",
  "segment-404",
  "slow-segments",
  "playlist-500",
  "discontinuity",
  "restart",
  "end",
];
export const VARIANTS: readonly Variant[] = ["360p", "720p", "1080p"];
export const MODE_LABEL: Readonly<Record<LiveMode, string>> = { loop: "Loop", encode: "Encode" };

/** The qualities a new live channel starts with, and the least a channel keeps. */
export const DEFAULT_VARIANTS: readonly Variant[] = ["720p", "1080p"];
export const MIN_VARIANTS = 2;

/** The longest a fault lasts or waits: 24 hours, in milliseconds (`29` section 9.1). */
export const FAULT_MAX_MS = 86_400_000;

/** The labels each page's rows carry, so a page fixes its label column once. */
export const NEW_CHANNEL_LABELS = ["Name", "Kind", "Number", "Category", "Folder", "Stream address"] as const;
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
  "Fault",
  "Duration",
  "Delay",
  "State",
  "Problem",
  "Renditions",
  "Playlist",
  "Synced from",
] as const;

/** The rail's sections; the ids are the groups' ids, prefixed by the page (`lv-`, `st-`). A module constant: a new array
 *  every render would re-bind the scroll spy's listener. */
export const LIVE_SECTIONS = [
  { id: "lv-details", label: "Details" },
  { id: "lv-playback", label: "Playback" },
  { id: "lv-fault", label: "Fault" },
  { id: "lv-status", label: "Status" },
] as const;
export const STREAM_SECTIONS = [
  { id: "st-details", label: "Details" },
  { id: "st-stream", label: "Stream" },
  { id: "st-status", label: "Status" },
] as const;
export const LIVE_SECTION_IDS: readonly string[] = LIVE_SECTIONS.map((section) => section.id);
export const STREAM_SECTION_IDS: readonly string[] = STREAM_SECTIONS.map((section) => section.id);

/** Reasons a control is disabled (shown as its tooltip). */
export const DELETE_SYNCED_TIP = "The next sync adds it again. Disable it to keep it off.";
export const REBUILD_TIP = "Read the source again and rebuild this channel";
export const REBUILD_DISABLED = "A disabled channel cannot be rebuilt.";
export const REBUILD_RUNNING = "This channel is already being built.";
export const REVERT_TIP = "Drop the edits and take the playlist's values again";
export const REVERT_NONE = "Nothing edited yet.";
export const FAULT_NOT_LIVE = "A fault can be applied while the channel is live.";
export const FAULT_NONE = "No fault is applied.";
export const CHOOSE_FOLDER_TIP = "Choose a folder on the backend machine";
export const CHOOSE_UNAVAILABLE = "Folders can be chosen only in the backend's own window; type the path.";
export const REFRESH_TIP = "Read the channels again";
export const STATUS_REFRESH_TIP = "Read this channel's state again";
export const COPY_TIP = "Copy the address";
export const ADD_VIDEO_EMPTY = "Type a path first.";
export const ADD_VIDEO_DUPLICATE = "That video is already in the list.";
export const ALREADY_FIRST = "Already first";
export const ALREADY_LAST = "Already last";

/** Notices. */
export const NOTICE_SAVED = "Changes saved.";
export const NOTICE_DISCARDED = "Changes discarded.";
export const NOTICE_REFRESHED = "Channels refreshed.";
export const NOTICE_REVERTED = "Reverted to the playlist.";
export const NOTICE_FAULT_APPLIED = "Fault applied.";
export const NOTICE_FAULT_CLEARED = "Fault cleared.";
export const NOTICE_COPIED = "Address copied.";
export const NOTICE_NOT_COPIED = "The address could not be copied.";
export const noticeBuilding = (name: string): string => `${name} is preparing.`;
export const noticeLive = (name: string): string => `${name} is live.`;
export const noticeCreated = (name: string): string => `${name} created.`;
export const noticeDeleted = (name: string): string => `${name} deleted.`;
