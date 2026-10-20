import { REFUSAL_SENTENCES } from "@/constants/gate-copy";
import type { AuthResult, RefusalKind } from "@/types/auth";

/* The gate's state and its one transition function (`34` section 3; the dialog gate of `63` section 3.1). Pure: the
 * sign-in hook awaits the port, the store applies the result, and this decides what the gate becomes. */

export type RefusedPhase = "refused" | "unreachable";

export type GateState =
  | { readonly phase: "idle"; readonly notice: string | null }
  | { readonly phase: "submitting" }
  | { readonly phase: RefusedPhase; readonly sentence: string };

export type GateEvent =
  | { readonly type: "submit" }
  | { readonly type: "answer"; readonly result: AuthResult }
  | { readonly type: "ended"; readonly sentence: string };

export const GATE_START: GateState = { phase: "idle", notice: null };

/** The phase a refusal puts the gate in: a wrong pair is `refused`; an unreachable backend is `unreachable`. */
function phaseFor(kind: RefusalKind): RefusedPhase {
  return kind === "invalid" ? "refused" : "unreachable";
}

/** The next gate state. A submit while submitting, and an answer when nothing is waiting for one (a sign-out raced
 *  it), change nothing. A successful answer returns the gate to rest: the session is established by the caller. */
export function nextGate(state: GateState, event: GateEvent): GateState {
  switch (event.type) {
    case "submit":
      return state.phase === "submitting" ? state : { phase: "submitting" };
    case "answer":
      if (state.phase !== "submitting") return state;
      if (event.result.ok) return GATE_START;
      return { phase: phaseFor(event.result.refusal), sentence: REFUSAL_SENTENCES[event.result.refusal] };
    case "ended":
      return { phase: "idle", notice: event.sentence };
  }
}

/** The sentence to show under the Password row, or null. */
export function gateError(state: GateState): string | null {
  return state.phase === "refused" || state.phase === "unreachable" ? state.sentence : null;
}

/** The notice card's sentence, or null. */
export function gateNotice(state: GateState): string | null {
  return state.phase === "idle" ? state.notice : null;
}
