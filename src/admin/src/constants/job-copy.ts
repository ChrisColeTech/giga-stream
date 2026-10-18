/* The Jobs tab's words (`38` section 4): labels, tips, disabled reasons and notices. Copy lives here, never in a
 * component, so a refusal reads the same on the toolbar and in the workspace. */

/** The rows' labels, so each page fixes its label column once. The New form makes catalog jobs: Name, Scope, Kind. */
export const NEW_JOB_LABELS: readonly string[] = ["Name", "Scope", "Kind"];
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
  "State",
  "When",
  "Outcome",
  "Counts",
  "Source",
  "Refused",
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
export const TYPE_FIXED_TIP = "A playlist job syncs one playlist. A catalog job syncs a TMDB list into titles. Fixed once the job exists.";
export const PLAYLIST_TIP = "The playlist this job syncs. The job goes with the playlist.";
export const SCOPE_TIP = "Which TMDB list to walk: what is trending now, what is popular overall, or the whole library.";
export const KIND_TIP = "Whether the job syncs movies or series. A discover walk covers both.";
export const ENABLED_TIP = "A disabled job is not run by the timer. A playlist job still runs by hand while its playlist is enabled.";
export const PAGES_TIP = "How many pages of the list to walk, 1 to 500.";
export const INTERVAL_TIP = "How often the job runs by itself. Off stops it; a job also needs Enabled to run.";
export const CUSTOM_TIP = "A number and s, m or h, like 90m or 3h.";
export const STATUS_TIP = "Scheduled runs by itself; Not scheduled has the interval off; Disabled never runs.";
export const NAME_TIP = "What the job is called in the list. 1 to 120 characters.";
export const RUN_STATE_TIP = "Whether the job is running now, or how its last run ended. Refresh to read the result.";
export const WHEN_TIP = "When the job last ran.";
export const OUTCOME_TIP = "What the last run did, in words.";
export const COUNTS_TIP = "How many channels the last run created, updated, skipped or refused.";
export const JOB_SOURCE_TIP = "What the last run did about the playlist's own list.";
export const REFUSED_TIP = "Entries the last run refused. Each names the entry, never its address.";
export const TITLES_TIP = "How many titles the last run wrote.";
export const DETAILS_TIP = "How many titles the last run gave their full detail (plot, cast, runtime).";
export const SEASONS_TIP = "How many series seasons the last run gave their episodes.";
export const STALE_TIP = "Titles whose stored copy is old; the next run refetches them.";
export const DELETE_TITLE = "Deletes the job; what it synced stays.";
export const PLAYLIST_JOB_OWNED = "A playlist's job goes with the playlist.";

/** Disabled reasons, in the `Run job` order (`38` section 4.2). */
export const RUN_JOB = "Run job";
export const RUN_TIP = "Start the job now. Press Refresh on Last run to read its result.";
export const RUN_RUNNING = "A ticked job is already running.";
export const RUN_PLAYLIST_OFF = "A ticked job's playlist is disabled.";
export const RESUME_JOB = "Resume";
export const RESUME_TIP = "Run the job again; it carries on where the stopped run left off.";
export const STOP_JOB = "Stop";
export const STOP_TIP = "Stop the running job. What it already wrote is kept.";
export const STOPPING_REASON = "Stopping.";
export const NOT_RUNNING_REASON = "Not running.";
export const THAT_NOT_RUNNING = "That job is not running.";
export const SAVE_JOB_FIRST = "Save the job first";
export const RUNNING_REASON = "Running.";
export const WORKING_REASON = "Working.";
export const DELETE_RUNNING = "A running job cannot be deleted.";
export const EVERY_JOB_ENABLED = "Every ticked job is already enabled.";
export const EVERY_JOB_DISABLED = "Every ticked job is already disabled.";

/** Value refusals. */
export const NAME_LENGTH = "Name must be 1 to 120 characters.";
export const NAME_MAX = 120;
export const PAGES_MIN = 1;
export const PAGES_MAX = 500;

/** Notices. */
export const jobCreated = (name: string): string => `Created ${name}.`;
export const jobSaved = (name: string): string => `Saved ${name}.`;
export const jobDeleted = (name: string): string => `Deleted ${name}.`;
export const jobStopping = (name: string): string => `Stopping ${name}.`;
export const jobStarted =(name: string): string => `Started ${name}.`;
export const unreadableJobs = (count: number): string => `${count} ${count === 1 ? "job" : "jobs"} could not be read.`;
export const JOB_GONE = "That job no longer exists.";
