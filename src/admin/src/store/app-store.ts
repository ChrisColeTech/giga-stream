import { create } from "zustand";
import type { Box } from "@giga/ui/lib/child-types";
import { createChromeSlice } from "@giga/ui/store/chrome-slice";
import type { ChromeKinds, ChromeSlice } from "@giga/ui/store/chrome-types";
import { APPEARANCE_DEFAULTS } from "@/constants/settings-sections";
import type { EventArea } from "@/types/events";
import type { OverlayId } from "@/types/overlays";
import { auditSlice, type AuditSlice } from "./audit-slice";
import { panesSlice, type PanesSlice } from "./panes-slice";
import { sessionSlice, startingEvents, type SessionSlice } from "./session-slice";
import { workSlice, type WorkSlice } from "./work-slice";
import { workspaceSlice, type WorkspaceSlice } from "./workspace-slice";

/** The admin's kinds for the shared chrome slice (`docs/27` section 3: the chrome slice is spread into one store). The
 *  admin opens no popup and no item-bound window, so an overlay hangs from nothing. */
export interface AdminKinds extends ChromeKinds {
  area: EventArea;
  overlay: OverlayId;
  anchor: null;
  item: null;
  box: Box;
}

/** The one store (`01` section 6). Serializable shell state only: no nodes, refs, promises or timers. Nothing here reads
 *  or writes browser storage; the account's saved appearance and layout arrive in Wave 7 (`29`). */
export type AppState = ChromeSlice<AdminKinds> &
  WorkspaceSlice &
  PanesSlice &
  SessionSlice &
  AuditSlice &
  WorkSlice;

export const useAppStore = create<AppState>()((set, get) => {
  const session = sessionSlice(set);
  return {
    ...createChromeSlice<AdminKinds>(set, get, {
      defaults: APPEARANCE_DEFAULTS,
      defaultArea: "Connection",
      events: startingEvents(session.signedIn),
    }),
    ...workspaceSlice(set, get),
    ...panesSlice(set, get),
    ...session,
    ...auditSlice(set, get),
    ...workSlice(set, get),
  };
});
