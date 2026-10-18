import {
  RESET_DONE_NOTICE,
  RESET_DONE_TITLE,
  RESET_FAILED_TITLE,
  RESET_INVALID,
  RESET_RATE_LIMITED,
  RESET_UNREACHABLE,
  RESET_WEAK,
} from "@/constants/reset-copy";
import type { ResetResult, ResetStartResult } from "@/types/auth";

/* The gate's reset views and their one transition function (`40` section 4.1). Pure: the hooks await the port and hand
 * the answers in as events; this decides what the wall shows. Views: `signin` -> `reset-username` -> `reset-answer` ->
 * `signin` (on success). No timer, no code, no message sent anywhere. The typed username is carried along, so it is never
 * typed twice. */

export type ResetView = "signin" | "reset-username" | "reset-answer";

/** A card on the wall: a title and one sentence (the success notice, or a failure that has no field to sit under). */
export interface ResetNotice {
  readonly title: string;
  readonly sentence: string;
}

/** A refusal that sits under its own row. */
export interface ResetFieldError {
  readonly field: "answer" | "newPassword";
  readonly sentence: string;
}

export interface ResetState {
  readonly view: ResetView;
  readonly username: string;
  /** The question being answered; empty before `reset-start` has answered. */
  readonly question: string;
  /** A call is waiting for its answer: a second submit is ignored. */
  readonly busy: boolean;
  readonly notice: ResetNotice | null;
  readonly error: ResetFieldError | null;
}

export type ResetEvent =
  | { readonly type: "forgot"; readonly username: string }
  | { readonly type: "back"; readonly username?: string }
  | { readonly type: "submit" }
  | { readonly type: "started"; readonly username: string; readonly result: ResetStartResult }
  | { readonly type: "finished"; readonly result: ResetResult }
  | { readonly type: "refused"; readonly field: ResetFieldError["field"]; readonly sentence: string };

export const RESET_START: ResetState = {
  view: "signin",
  username: "",
  question: "",
  busy: false,
  notice: null,
  error: null,
};

const failure = (sentence: string): ResetNotice => ({ title: RESET_FAILED_TITLE, sentence });
const FAILED: Readonly<Record<"rate_limited" | "unreachable", ResetNotice>> = {
  rate_limited: failure(RESET_RATE_LIMITED),
  unreachable: failure(RESET_UNREACHABLE),
};

function started(state: ResetState, username: string, result: ResetStartResult): ResetState {
  if (state.view !== "reset-username" || !state.busy) return state;
  if (!result.ok) return { ...state, busy: false, notice: FAILED[result.refusal] };
  return { ...state, view: "reset-answer", username, question: result.question, busy: false, notice: null };
}

function finished(state: ResetState, result: ResetResult): ResetState {
  if (state.view !== "reset-answer" || !state.busy) return state;
  const rest = { ...state, busy: false };
  if (result.ok) {
    const notice = { title: RESET_DONE_TITLE, sentence: RESET_DONE_NOTICE };
    return { ...rest, view: "signin", question: "", notice, error: null };
  }
  switch (result.refusal) {
    case "invalid":
      return { ...rest, error: { field: "answer", sentence: RESET_INVALID } };
    case "weak":
      return { ...rest, error: { field: "newPassword", sentence: RESET_WEAK } };
    default:
      return { ...rest, notice: FAILED[result.refusal] };
  }
}

/** The next state. Events that do not fit the current view (an answer after the person went back, a second submit) change
 *  nothing. */
export function nextReset(state: ResetState, event: ResetEvent): ResetState {
  switch (event.type) {
    case "forgot":
      if (state.view !== "signin") return state;
      return { ...RESET_START, view: "reset-username", username: event.username };
    case "back":
      if (state.view === "signin" || state.busy) return state;
      return { ...RESET_START, username: event.username ?? state.username };
    case "submit":
      if (state.view === "signin" || state.busy) return state;
      return { ...state, busy: true, notice: null, error: null };
    case "started":
      return started(state, event.username, event.result);
    case "finished":
      return finished(state, event.result);
    case "refused":
      if (state.view !== "reset-answer" || state.busy) return state;
      return { ...state, error: { field: event.field, sentence: event.sentence } };
  }
}
