/* A record's state as the word its list row wears (`28` section 9, item 2): `live`, `preparing`, `failed`, `stopped`,
 * `disabled`, `synced`, `edited`, `manual`, `idle`, `running`, `enabled`. Always a word, never a dot or an edge strip. A
 * disabled record stays in its list, dimmed, and its word is `disabled` whatever else is true of it. Pure. */

export type LiveState = "preparing" | "starting" | "live" | "restarting" | "stopped" | "failed";

export type StateWord = LiveState | "disabled" | "synced" | "edited" | "manual" | "idle" | "running" | "enabled";

/** The colour a word takes: the status tokens (`done`, `loading`, `failed`), the faint text, or the accent. */
export type StateTone = "done" | "loading" | "failed" | "faint" | "accent";

export interface RowState {
  /** The word, also the row's `data-st`. */
  readonly word: StateWord;
  readonly tone: StateTone;
  /** A disabled record is dimmed to 45%. */
  readonly dimmed: boolean;
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
  stopped: "faint",
  synced: "faint",
  idle: "faint",
  disabled: "faint",
  manual: "accent",
};

const state = (word: StateWord): RowState => ({ word, tone: TONES[word], dimmed: word === "disabled" });

export interface ChannelStateInput {
  readonly enabled: boolean;
  /** A live channel's engine state; a stream channel has none. */
  readonly state?: LiveState;
  /** A stream channel's origin: synced from a playlist, synced then edited, or added by hand. */
  readonly origin?: "synced" | "edited" | "manual";
}

export function channelState(channel: ChannelStateInput): RowState {
  if (!channel.enabled) return state("disabled");
  return state(channel.state ?? channel.origin ?? "manual");
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
}

export function jobState(job: JobStateInput): RowState {
  if (!job.enabled) return state("disabled");
  return state(job.running ? "running" : job.failed ? "failed" : "idle");
}

/** A provider, a playlist or an account: enabled or disabled and nothing else. */
export function enabledState(enabled: boolean): RowState {
  return state(enabled ? "enabled" : "disabled");
}
