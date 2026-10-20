import type { GateState } from "@/lib/gate-state";
import { GATE_START, nextGate } from "@/lib/gate-state";
import type { AuthResult, AuthSession, SessionActor, SessionTokens } from "@/types/auth";
import type { SettingsAnswer } from "@/services/schemas/settings-schema";
import type { AppState } from "@/store/app-store";
import { applyAccountSettings } from "@/store/shell-hydration";

/* Who is signed in, and what the gate is doing (`62` sections 3.5 and 3.6; the dialog gate of `63` section 3.1), a
 * slice of the one store. The slice holds no promise: the gate's hooks await the auth port and hand the answers in.
 * The actor and the tokens live here, in memory, and nowhere else (D4): a reload starts `restoring` while one probe
 * of the httpOnly refresh cookie decides between a session and none. The request layer reads `tokens` for the bearer
 * and writes `endSession` on a 401. Signed out, the app keeps running - the surfaces that need an account hide
 * (`63` section 3.4). */

export interface SessionSlice {
  signedIn: boolean;
  /** Who the session belongs to: the account row's id, username and kind. */
  session: SessionActor | null;
  /** The access and refresh tokens and their expiries; null signed out. */
  tokens: SessionTokens | null;
  gate: GateState;
  /** True from load until the boot's restore probe answers, so a restored session never flashes a form. */
  restoring: boolean;
  /** The Sign in verb was pressed: the gate waits for the port. Ignored while it already waits. */
  beginSignIn: () => void;
  /** The port answered. Accepted, the session starts; refused, the gate stays with the sentence. */
  finishSignIn: (result: AuthResult) => void;
  /** The boot probe answered: a restored session starts like a sign-in (without a notice); null leaves the app
   *  signed out. Only the first answer counts, so a double mount or a probe that lands after the fallback changes
   *  nothing. */
  finishRestore: (session: AuthSession | null) => void;
  /** The account's settings document wins once at sign-in (`62` D8); `replaced` says whether the account's document
   *  had anything in it to replace the device's settings with. */
  applyAccountSettings: (settings: SettingsAnswer, replaced: boolean) => void;
  /** The session ended under the app (a 401 the cookie could not answer): the app drops to signed out and the
   *  dialog's gate carries `sentence` on its notice when it is next opened. */
  endSession: (sentence: string) => void;
  /** The user signed out: the app keeps running signed out, and the device's local state is kept - nothing is
   *  wiped (`62` D8). */
  signOut: () => void;
}

type Set = (partial: Partial<AppState>) => void;
type Get = () => AppState;

/** Everything a session leaves behind, put back to the signed-out start. The shell, the settings fields and the
 *  device's local stores are deliberately untouched: sign-out keeps the device's state (`62` D8). */
const signedOut = (gate: GateState): Partial<AppState> => ({
  signedIn: false,
  session: null,
  tokens: null,
  gate,
});

export function sessionSlice(set: Set, get: Get): SessionSlice {
  return {
    signedIn: false,
    session: null,
    tokens: null,
    gate: GATE_START,
    restoring: true,
    beginSignIn: () => set({ gate: nextGate(get().gate, { type: "submit" }) }),
    finishSignIn: (result) => {
      const gate = nextGate(get().gate, { type: "answer", result });
      if (gate === get().gate) return;
      if (!result.ok) return set({ gate });
      set({ signedIn: true, session: result.session.actor, tokens: result.session.tokens, gate });
    },
    finishRestore: (session) => {
      if (!get().restoring) return;
      if (session === null || get().signedIn) return set({ restoring: false });
      set({ restoring: false, signedIn: true, session: session.actor, tokens: session.tokens });
    },
    applyAccountSettings: (settings, replaced) => applyAccountSettings(set, get, settings, replaced),
    endSession: (sentence) => set(signedOut(nextGate(get().gate, { type: "ended", sentence }))),
    signOut: () => set(signedOut(GATE_START)),
  };
}
