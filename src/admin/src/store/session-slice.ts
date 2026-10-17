import type { EventRow } from "@giga/ui/lib/event-log";
import { FIXTURE_SIGNED_IN } from "@/constants/fixture-switches";
import { DEFAULT_TAB } from "@/constants/tabs";
import { initialEvents } from "@/fixtures/audit";
import { actorFor, FIXTURE_ACTOR, type SessionActor } from "@/fixtures/session";
import type { EventArea } from "@/types/events";
import type { OverlayId } from "@/types/overlays";
import type { Tab } from "@/types/shell";
import { NO_WORKSPACES, type WorkspaceMap } from "./workspace-slice";

/* Who is signed in, a slice of the one store. The fixture build signs in as whoever types an email and a password; `29`
 * (Wave 7) replaces this with the real session. The audit log is read after sign-in, so the Events drawer is empty
 * (five shimmer lines) before it and again after sign-out. Signing out lands on the sign-in page with the chrome in
 * place and every tab back at its index, so nothing of one account is left for the next. */
export interface SessionSlice {
  signedIn: boolean;
  actor: SessionActor | null;
  signIn: (email: string) => void;
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

/** The rows a signed-in session starts with: the fixture audit tail, or none before sign-in. */
export const startingEvents = (signedIn: boolean): readonly EventRow<EventArea>[] => (signedIn ? initialEvents() : []);

export function sessionSlice(set: Set): SessionSlice {
  return {
    signedIn: FIXTURE_SIGNED_IN,
    actor: FIXTURE_SIGNED_IN ? FIXTURE_ACTOR : null,
    signIn: (email) => set({ signedIn: true, actor: actorFor(email), events: startingEvents(true), olderLoaded: 0 }),
    signOut: () =>
      set({
        signedIn: false,
        actor: null,
        tab: DEFAULT_TAB,
        workspaces: NO_WORKSPACES,
        overlay: null,
        overlayAnchor: null,
        overlayItem: null,
        events: [],
        olderLoaded: 0,
      }),
  };
}
