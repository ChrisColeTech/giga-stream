import type { EventRow } from "@giga/ui/lib/event-log";
import { FIXTURE_SIGNED_IN } from "@/constants/fixture-switches";
import { DEFAULT_TAB } from "@/constants/tabs";
import { initialEvents } from "@/fixtures/audit";
import { FIXTURE_ACTOR } from "@/fixtures/session";
import { GATE_START, nextGate, type GateState } from "@/lib/gate-state";
import type { AuthResult, SessionActor } from "@/types/auth";
import type { EventArea } from "@/types/events";
import type { OverlayId } from "@/types/overlays";
import type { Tab } from "@/types/shell";
import { NO_WORKSPACES, type WorkspaceMap } from "./workspace-slice";

/* Who is signed in, and what the gate is doing, a slice of the one store (`34` section 5). The slice holds no promise:
 * `hooks/useSignIn.ts` awaits the auth port and hands the answer to `finishSignIn`. `29` (Wave 7) keeps this contract and
 * adds the tokens beside `actor`. The audit log is read after sign-in, so the Events drawer is empty (five shimmer lines)
 * before it and again after sign-out. Signing out lands on the gate with the chrome in place and every tab back at its
 * index, so nothing of one account is left for the next. */
export interface SessionSlice {
  signedIn: boolean;
  actor: SessionActor | null;
  gate: GateState;
  /** The Sign in verb was pressed: the gate waits for the port. Ignored while it already waits. */
  beginSignIn: () => void;
  /** The port answered. Accepted, the session starts; refused, the user stays on the gate with the sentence. */
  finishSignIn: (result: AuthResult) => void;
  /** The session ended under the app (a failed refresh, a second 401): the gate returns with `sentence` on its notice. */
  endSession: (sentence: string) => void;
  /** The user signed out: the gate returns with nothing said on it. */
  signOut: () => void;
}

interface Host {
  tab: Tab;
  workspaces: WorkspaceMap;
  overlay: OverlayId | null;
  overlayAnchor: null;
  overlayItem: null;
  events: readonly EventRow<EventArea>[];
  olderLoaded: number;
}

type Set = (partial: Partial<SessionSlice & Host>) => void;
type Get = () => SessionSlice;

/** The rows a signed-in session starts with: the fixture audit tail, or none before sign-in. */
export const startingEvents = (signedIn: boolean): readonly EventRow<EventArea>[] => (signedIn ? initialEvents() : []);

/** Everything one account leaves behind, put back to the signed-out start. */
const signedOut = (gate: GateState): Partial<SessionSlice & Host> => ({
  signedIn: false,
  actor: null,
  gate,
  tab: DEFAULT_TAB,
  workspaces: NO_WORKSPACES,
  overlay: null,
  overlayAnchor: null,
  overlayItem: null,
  events: [],
  olderLoaded: 0,
});

export function sessionSlice(set: Set, get: Get): SessionSlice {
  return {
    signedIn: FIXTURE_SIGNED_IN,
    actor: FIXTURE_SIGNED_IN ? FIXTURE_ACTOR : null,
    gate: GATE_START,
    beginSignIn: () => set({ gate: nextGate(get().gate, { type: "submit" }) }),
    finishSignIn: (result) => {
      const gate = nextGate(get().gate, { type: "answer", result });
      if (gate === get().gate) return;
      if (!result.ok) return set({ gate });
      set({ signedIn: true, actor: result.session.actor, gate, events: startingEvents(true), olderLoaded: 0 });
    },
    endSession: (sentence) => set(signedOut(nextGate(get().gate, { type: "ended", sentence }))),
    signOut: () => set(signedOut(GATE_START)),
  };
}
