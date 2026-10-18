import type { EventRow } from "@giga/ui/lib/event-log";
import { DEFAULT_TAB } from "@/constants/tabs";
import { GATE_START, nextGate, type GateState } from "@/lib/gate-state";
import type { AuthResult, SessionActor, SessionTokens } from "@/types/auth";
import type { EventArea } from "@/types/events";
import type { OverlayId } from "@/types/overlays";
import type { Tab } from "@/types/shell";
import { NO_ACCOUNTS, type AccountsState } from "./accounts-slice";
import { NO_STALE } from "./slices/stale";
import { NO_WORKSPACES, type WorkspaceMap } from "./workspace-slice";

/* Who is signed in, and what the gate is doing, a slice of the one store (`34` section 5, `29` section 6). The slice holds
 * no promise: `hooks/useSignIn.ts` awaits the auth port and hands the answer to `finishSignIn`. The tokens live here, in
 * memory, and nowhere else: a reload starts at the gate. The request layer reads `tokens` and writes a refresh through
 * `adoptTokens`. The audit log is read after sign-in, so the Events drawer is empty (five shimmer lines) before it and
 * again after sign-out. Signing out lands on the gate with the chrome in place and every tab back at its index, so
 * nothing of one account is left for the next. */
export interface SessionSlice {
  signedIn: boolean;
  actor: SessionActor | null;
  /** The access and refresh tokens and their expiries; null signed out. */
  tokens: SessionTokens | null;
  /** Raised at every sign-in. A flow records it before it awaits and writes only if it is unchanged (and the session
   *  still on) afterwards, so an answer from an earlier session is dropped (`35` section 5.2). */
  serial: number;
  gate: GateState;
  /** The Sign in verb was pressed: the gate waits for the port. Ignored while it already waits. */
  beginSignIn: () => void;
  /** The port answered. Accepted, the session starts; refused, the user stays on the gate with the sentence. */
  finishSignIn: (result: AuthResult) => void;
  /** A refresh answered: the new tokens replace the old whole (the refresh token is single-use). */
  adoptTokens: (tokens: SessionTokens) => void;
  /** The signed-in account changed its own email or name: the actor follows (the id never changes). */
  updateActor: (account: SessionActor) => void;
  /** The session ended under the app (a failed refresh, a second 401, an own password change): the gate returns with
   *  `sentence` on its notice. */
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
  olderCursor: number | null;
  accounts: AccountsState;
  stale: Readonly<Record<Tab, boolean>>;
}

type Set = (partial: Partial<SessionSlice & Host>) => void;
type Get = () => SessionSlice;

/** Everything one account leaves behind, put back to the signed-out start. */
const signedOut = (gate: GateState): Partial<SessionSlice & Host> => ({
  signedIn: false,
  actor: null,
  tokens: null,
  gate,
  tab: DEFAULT_TAB,
  workspaces: NO_WORKSPACES,
  overlay: null,
  overlayAnchor: null,
  overlayItem: null,
  events: [],
  olderCursor: null,
  accounts: NO_ACCOUNTS,
  stale: NO_STALE,
});

export function sessionSlice(set: Set, get: Get): SessionSlice {
  return {
    signedIn: false,
    actor: null,
    tokens: null,
    serial: 0,
    gate: GATE_START,
    beginSignIn: () => set({ gate: nextGate(get().gate, { type: "submit" }) }),
    finishSignIn: (result) => {
      const gate = nextGate(get().gate, { type: "answer", result });
      if (gate === get().gate) return;
      if (!result.ok) return set({ gate });
      const { actor, tokens } = result.session;
      set({ signedIn: true, actor, tokens, gate, serial: get().serial + 1, olderCursor: null });
    },
    adoptTokens: (tokens) => {
      if (get().signedIn) set({ tokens });
    },
    updateActor: (actor) => {
      if (get().signedIn) set({ actor: { id: actor.id, email: actor.email, name: actor.name } });
    },
    endSession: (sentence) => set(signedOut(nextGate(get().gate, { type: "ended", sentence }))),
    signOut: () => set(signedOut(GATE_START)),
  };
}
