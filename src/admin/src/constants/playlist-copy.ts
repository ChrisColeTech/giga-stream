/* The Playlists tab's words (`38` section 3, `43` section 4.1): labels, tips, disabled reasons and notices. Copy lives
 * here, never in a component. No sentence here ever takes the address as a value. */

/** The rows' labels, so each page fixes its label column once. */
export const NEW_PLAYLIST_LABELS: readonly string[] = ["Name", "Source", "File", "Address"];
export const PLAYLIST_WORKSPACE_LABELS: readonly string[] = [
  "Name",
  "Address",
  "Enabled",
  "Host",
  "File",
  "Source type",
  "Channels",
  "Last run",
  "Result",
];

export const PLAYLIST_SECTIONS = [
  { id: "pw-details", label: "Details" },
  { id: "pw-status", label: "Status" },
] as const;
export const PLAYLIST_SECTION_KEYS: readonly string[] = PLAYLIST_SECTIONS.map((section) => section.id);

/** Source type, as the Segmented and the Status row word it. */
export const SOURCE_FILE = "File";
export const SOURCE_URL = "Web address";

/** Tips. Name carries the rule that decides it. */
export const SOURCE_TIP = "Import a playlist file from this machine, or fetch one from a web address.";
export const FILE_TIP = "An .m3u or .m3u8 file. It is read once; the file itself is not kept.";
export const NAME_TIP = "What the playlist is called in the list. 1 to 120 characters.";
export const NEW_ADDRESS_TIP = "An http or https address.";
export const ADDRESS_TIP = "An http or https address.";
export const FILE_ADDRESS_TIP = "A file playlist was read once and has no web address.";
export const ENABLED_TIP = "A disabled playlist is skipped by every job and its channels are left out of what players read.";
export const HOST_TIP = "The host of the address.";
export const FILE_NAME_TIP = "The file this playlist was imported from.";
export const SOURCE_TYPE_TIP = "Whether the playlist came from a file or from a web address.";
export const CHANNELS_TIP = "How many channels it has, how many are enabled, and what the checks found.";
export const LAST_RUN_TIP = "When the playlist's job last ran.";
export const RESULT_TIP = "What the playlist's job did the last time it ran.";
export const CHOOSE_FILE_TITLE = "Choose a playlist file";
export const IMPORT_FILE_ACCEPT = ".m3u,.m3u8,audio/x-mpegurl";

/** Disabled reasons and refusals. */
export const FILE_REQUIRED = "Choose a file first.";
export const ADDRESS_REQUIRED = "Address is required.";
export const NAME_REQUIRED = "Name is required.";
export const IMPORTING_REASON = "Importing.";
export const NO_CHANNELS_REASON = "This playlist has no channels.";
export const NAME_LONG = "Name must be at most 120 characters.";
export const NAME_MAX = 120;

/** The bulk verbs (`38` section 3.2). */
export const SYNC_NOW = "Sync now";
export const SYNC_ONE_TIP = "Sync this playlist now";
export const SYNC_PLAYLIST_DISABLED = "A disabled playlist cannot sync.";
export const SYNC_NO_JOB = "This playlist has no job to run.";
export const SYNC_JOB_RUNNING = "That job is already running.";
export const EVERY_PLAYLIST_ENABLED = "Every ticked playlist is already enabled.";
export const EVERY_PLAYLIST_DISABLED = "Every ticked playlist is already disabled.";

/** The armed Delete's rest title and question: the channels and the job go with the playlist. */
export const DELETE_TITLE = "Deletes the playlist, its channels and its job.";
export const deleteQuestion = (name: string, channels: number): string =>
  `Delete ${name} and its ${channels.toLocaleString("en-US")} ${channels === 1 ? "channel" : "channels"}?`;

const plural = (count: number): string => `${count.toLocaleString("en-US")} ${count === 1 ? "channel" : "channels"}`;

/** Notices. An import says what the answer counted, nothing more: a new playlist's channels all land disabled. */
export const playlistImported = (name: string, created: boolean, counts: { created: number; updated: number }): string =>
  created
    ? `Imported ${name}: ${plural(counts.created)}, all disabled. Enable them on the Channels tab.`
    : `Imported ${name} again: ${counts.created.toLocaleString("en-US")} created, ${counts.updated.toLocaleString("en-US")} updated.`;
export const playlistDeleted = (name: string, deleted: { channels: number }): string =>
  `Deleted ${name} and ${plural(deleted.channels)}.`;
export const unreadablePlaylists = (count: number): string =>
  `${count} ${count === 1 ? "playlist" : "playlists"} could not be read.`;
export const PLAYLIST_GONE = "That playlist no longer exists.";
