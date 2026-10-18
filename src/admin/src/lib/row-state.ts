/* A record's state as the word its list row wears (`28` section 9, item 2): `live`, `preparing`, `failed`, `stopped`,
 * `disabled`, `synced`, `edited`, `manual`, `idle`, `running`, `enabled`. Always a word, never a dot or an edge strip. A
 * disabled record stays in its list, dimmed, and its word is `disabled` whatever else is true of it. Pure. */

import { HELD_HINT } from "@/constants/channel-copy";

export type LiveState = "preparing" | "starting" | "live" | "restarting" | "stopped" | "failed";

export type StateWord =
  | LiveState
  | "disabled"
  | "held"
  | "synced"
  | "edited"
  | "manual"
  | "idle"
  | "running"
  | "enabled"
  | "dead"
  | "not checked"
  | "stored"
  | "deleted";

/** The colour a word takes: the status tokens (`done`, `loading`, `failed`), the faint text, or the accent. */
export type StateTone = "done" | "loading" | "failed" | "faint" | "accent";

export interface RowState {
  /** The word, also the row's `data-st`. */
  readonly word: StateWord;
  readonly tone: StateTone;
  /** A disabled record is dimmed to 45%. */
  readonly dimmed: boolean;
  /** A tooltip for the word, when the word alone does not say why (`held`). */
  readonly hint?: string;
  /** What the cell reads when it is more than the word (`running 46%`); the word stays the row's `data-st`. */
  readonly label?: string;
}

const TONES: Readonly<Record<StateWord, StateTone>> = {
  live: "done",
  enabled: "done",
  preparing: "loading",
  starting: "loading",
  restarting: "loading",
  running: "loading",
  edited: "loading",
  failed: "failed",
  dead: "failed",
  "not checked": "faint",
  stopped: "faint",
  held: "faint",
  synced: "faint",
  idle: "faint",
  disabled: "faint",
  stored: "faint",
  deleted: "faint",
  manual: "accent",
};

const state = (word: StateWord): RowState => ({
  word,
  tone: TONES[word],
  dimmed: word === "disabled" || word === "stored" || word === "deleted",
});

/** A Browse TMDB row's word (`docs/47` section 3.3): `deleted` (the admin deleted it; it stays deleted), `stored` (the
 *  store already holds it), or null for a title TMDB has that the store lacks. Both words dim the row. */
export function browseState(row: { readonly stored?: boolean; readonly deleted?: boolean }): RowState | null {
  if (row.deleted === true) return state("deleted");
  return row.stored === true ? state("stored") : null;
}

export interface ChannelStateInput {
  readonly enabled: boolean;
  /** A live channel's engine state; a stream channel has none. */
  readonly state?: LiveState;
  /** A stream channel's origin: synced from a playlist, synced then edited, or added by hand. */
  readonly origin?: "synced" | "edited" | "manual";
  /** What a player reads: false on an enabled channel whose playlist is disabled. Absent counts as published. */
  readonly published?: boolean;
}

export function channelState(channel: ChannelStateInput): RowState {
  if (!channel.enabled) return state("disabled");
  if (channel.published === false) return { ...state("held"), hint: HELD_HINT };
  return state(channel.state ?? channel.origin ?? "manual");
}

const STREAM_HINTS: Readonly<Partial<Record<StateWord, string>>> = {
  live: "The address answered with an HLS manifest",
  dead: "No HLS manifest at this address",
  "not checked": "No check has run on this address yet",
};

/** The `stream` column word of a stream channel (`43` section 4.1): `live`, `dead` or `not checked` (no verdict yet). A
 *  live-kind channel has no stream to check and no word. Never dimmed: a disabled row dims as a whole. */
export function streamStatusState(status: "live" | "dead" | undefined): RowState {
  const word: StateWord = status ?? "not checked";
  return { word, tone: TONES[word], dimmed: false, hint: STREAM_HINTS[word] };
}

export interface TitleStateInput {
  readonly enabled: boolean;
  /** Added by hand, with no TMDB id. */
  readonly manual: boolean;
  /** Synced from TMDB and then edited by an admin. */
  readonly edited: boolean;
}

export function titleState(title: TitleStateInput): RowState {
  if (!title.enabled) return state("disabled");
  return state(title.manual ? "manual" : title.edited ? "edited" : "synced");
}

export interface JobStateInput {
  readonly enabled: boolean;
  readonly running: boolean;
  /** The last run failed. */
  readonly failed: boolean;
  /** The last run was stopped by an admin (`43` section 3.4a). */
  readonly stopped?: boolean;
  /** How far the running job is, in whole percent, when the stream or the job's answer says (`44` section 4). */
  readonly percent?: number;
}

export function jobState(job: JobStateInput): RowState {
  if (!job.enabled) return state("disabled");
  if (job.running && job.percent !== undefined) return { ...state("running"), label: `running ${job.percent}%` };
  return state(job.running ? "running" : job.failed ? "failed" : job.stopped === true ? "stopped" : "idle");
}

/** A provider, a playlist or an account: enabled or disabled and nothing else. */
export function enabledState(enabled: boolean): RowState {
  return state(enabled ? "enabled" : "disabled");
}
