/* The Playlists tab's words (`38` section 3): labels, tips, disabled reasons and notices. Copy lives here, never in a
 * component. The address is a secret: no sentence here ever takes it as a value. */

/** The rows' labels, so each page fixes its label column once. Name first, even though it is optional (owner). */
export const NEW_PLAYLIST_LABELS: readonly string[] = ["Name", "Address"];
export const PLAYLIST_WORKSPACE_LABELS: readonly string[] = [
  "Name",
  "Address",
  "Enabled",
  "Host",
  "Channels",
  "Last synced",
  "Outcome",
];

export const PLAYLIST_SECTIONS = [
  { id: "pw-details", label: "Details" },
  { id: "pw-status", label: "Status" },
] as const;
export const PLAYLIST_SECTION_KEYS: readonly string[] = PLAYLIST_SECTIONS.map((section) => section.id);

/** Tips (the mockup's words). Name carries none: its label explains itself. */
export const NEW_ADDRESS_TIP = "https only. The address is stored but never shown again.";
export const ADDRESS_TIP = "https only. Never shown back. Replace it to set a new one.";
export const ENABLED_TIP = "A disabled playlist is skipped by every job.";
export const HOST_TIP = "The host of the address. The rest of the address is never shown.";
export const CHANNELS_TIP = "The channels a sync created from this playlist. Each opens its channel.";
export const LAST_SYNCED_TIP = "When a job last synced this playlist.";
export const OUTCOME_TIP = "What the last sync did.";
export const DELETE_TITLE = "The channels it created stay, as hand-made rows that no sync touches.";
export const REPLACE_TITLE = "Replace the stored address";

/** Disabled reasons and refusals. */
export const ADDRESS_REQUIRED = "Address is required.";
export const REPLACE_REASON = "Type the new value, then Save.";
export const NAME_LONG = "Name must be at most 120 characters.";
export const NAME_MAX = 120;

/** The bulk verbs (`38` section 3.2). */
export const SYNC_NOW = "Sync now";
export const SYNC_PLAYLIST_DISABLED = "A disabled playlist cannot sync.";
export const SYNC_NO_JOB = "No job syncs this playlist; create one on the Jobs tab.";
export const SYNC_JOB_DISABLED = "The job for this playlist is disabled.";
export const SYNC_JOB_RUNNING = "That job is already running.";
export const EVERY_PLAYLIST_ENABLED = "Every ticked playlist is already enabled.";
export const EVERY_PLAYLIST_DISABLED = "Every ticked playlist is already disabled.";

/** Notices. */
export const playlistCreated = (name: string): string => `Created ${name}.`;
export const playlistSaved = (name: string): string => `Saved ${name}.`;
export const playlistDeleted = (name: string, released: number): string =>
  `Deleted ${name}; ${released} ${released === 1 ? "channel" : "channels"} kept.`;
export const unreadablePlaylists = (count: number): string =>
  `${count} ${count === 1 ? "playlist" : "playlists"} could not be read.`;
export const PLAYLIST_GONE = "That playlist no longer exists.";
