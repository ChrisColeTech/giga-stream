/* The Jobs tab's words (`38` section 4): labels, tips, disabled reasons and notices. Copy lives here, never in a
 * component, so a refusal reads the same on the toolbar and in the workspace. */

/** The rows' labels, so each page fixes its label column once. Name first, then Type, then the type's rows. */
export const NEW_JOB_LABELS: readonly string[] = ["Name", "Type", "Playlist", "Scope", "Kind"];
export const JOB_WORKSPACE_LABELS: readonly string[] = [
  "Name",
  "Type",
  "Playlist",
  "Scope",
  "Kind",
  "Enabled",
  "Pages",
  "Interval",
  "Custom interval",
  "Status",
  "Dry run",
  "Prune",
  "State",
  "When",
  "Outcome",
  "Counts",
  "Refused",
  "Created",
  "Titles",
  "Stale",
];

export const JOB_SECTIONS = [
  { id: "jw-details", label: "Details" },
  { id: "jw-schedule", label: "Schedule" },
  { id: "jw-run", label: "Run" },
  { id: "jw-last", label: "Last run" },
] as const;
export const JOB_SECTION_KEYS: readonly string[] = JOB_SECTIONS.map((section) => section.id);

/** Tips (the mockup's words). */
export const TYPE_TIP =
  "A playlist job syncs one playlist into channels. A catalog job syncs a TMDB list into titles.";
export const TYPE_FIXED_TIP = "Fixed once the job exists.";
export const PLAYLIST_TIP = "The playlist this job syncs.";
export const SCOPE_TIP = "Which TMDB list to walk: what is trending now, or what is popular overall.";
export const KIND_TIP = "Whether the job syncs movies or series.";
export const ENABLED_TIP = "A disabled job is never run, by the timer or by hand.";
export const PAGES_TIP = "How many pages of the list to walk, 1 to 25.";
export const INTERVAL_TIP = "How often the job runs by itself. Off stops it; a job also needs Enabled to run.";
export const CUSTOM_TIP = "A number and s, m or h, like 90m or 3h.";
export const STATUS_TIP = "Scheduled runs by itself; Not scheduled has the interval off; Disabled never runs.";
export const DRY_RUN_TIP = "Count what a run would do and write nothing. Sent with this run only.";
export const PRUNE_TIP =
  "Deletes synced channels whose entry vanished. Channels you edited are kept. Sent with this run only.";
export const NAME_TIP = "What the job is called in the list. 1 to 120 characters.";
export const RUN_STATE_TIP = "Whether the job is running now, or how its last run ended.";
export const WHEN_TIP = "When the job last ran.";
export const OUTCOME_TIP = "What the last run did.";
export const COUNTS_TIP = "How many channels the last run created, updated, removed or refused.";
export const REFUSED_TIP = "Entries the last run refused, with the reason.";
export const CREATED_TIP = "The channels the last run created. Each opens its channel.";
export const TITLES_TIP = "How many titles the last run wrote.";
export const STALE_TIP = "Titles whose stored copy is old; the next run refetches them.";
export const DELETE_TITLE = "Deletes the job; what it synced stays.";
export const DISABLED_MARK = "disabled";

/** Disabled reasons, in the `Run job` order (`38` section 4.2). */
export const RUN_JOB = "Run job";
export const RUN_DISABLED = "Jobs that are disabled cannot run.";
export const RUN_RUNNING = "A ticked job is already running.";
export const RUN_PLAYLIST_OFF = "A ticked job's playlist is disabled.";
export const SAVE_JOB_FIRST = "Save the job first";
export const RUNNING_REASON = "Running.";
export const WORKING_REASON = "Working.";
export const PLAYLIST_REQUIRED = "Playlist is required.";
export const ADD_PLAYLIST_FIRST = "Add a playlist first.";
export const PLAYLISTS_UNREAD = "The playlists could not be read.";
export const DELETE_RUNNING = "A running job cannot be deleted.";
export const EVERY_JOB_ENABLED = "Every ticked job is already enabled.";
export const EVERY_JOB_DISABLED = "Every ticked job is already disabled.";

/** Value refusals. */
export const NAME_LENGTH = "Name must be 1 to 120 characters.";
export const NAME_MAX = 120;
export const PAGES_MIN = 1;
export const PAGES_MAX = 25;

/** Notices. */
export const jobCreated = (name: string): string => `Created ${name}.`;
export const jobSaved = (name: string): string => `Saved ${name}.`;
export const jobDeleted = (name: string): string => `Deleted ${name}.`;
export const jobStarted = (name: string): string => `Started ${name}.`;
export const jobRan = (name: string, outcome: string | undefined): string =>
  outcome === undefined ? `Ran ${name}.` : `Ran ${name}: ${outcome}`;
export const unreadableJobs = (count: number): string => `${count} ${count === 1 ? "job" : "jobs"} could not be read.`;
export const JOB_GONE = "That job no longer exists.";
