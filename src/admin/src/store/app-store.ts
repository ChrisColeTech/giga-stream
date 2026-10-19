import { create } from "zustand";
import type { Box } from "@giga/ui/lib/child-types";
import { createChromeSlice } from "@giga/ui/store/chrome-slice";
import type { ChromeKinds, ChromeSlice } from "@giga/ui/store/chrome-types";
import { APPEARANCE_DEFAULTS } from "@/constants/settings-sections";
import type { EventArea } from "@/types/events";
import type { OverlayId } from "@/types/overlays";
import type { AdminSettings } from "@/services/schemas/account-state-schema";
import { auditSlice, type AuditSlice } from "./audit-slice";
import { createListQueriesSlice, type ListQueriesSlice } from "./list-queries-slice";
import { panesSlice, type PanesSlice } from "./panes-slice";
import { sessionSlice, type SessionSlice } from "./session-slice";
import { tabSlices, type TabSlices } from "./slices";
import { createStaleSlice, type StaleSlice } from "./slices/stale";
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
type AdminChromeSlice = Omit<ChromeSlice<AdminKinds>, "theme" | "motion" | "setTheme" | "setMotion"> & {
  theme: AdminSettings["theme"];
  motion: AdminSettings["reducedMotion"];
  setTheme: (theme: AdminSettings["theme"]) => void;
  setMotion: (motion: AdminSettings["reducedMotion"]) => void;
};

export type AppState = AdminChromeSlice &
  WorkspaceSlice &
  PanesSlice &
  SessionSlice &
  AuditSlice &
  WorkSlice &
  StaleSlice &
  ListQueriesSlice &
  TabSlices;

export const useAppStore = create<AppState>()((set, get) => {
  const session = sessionSlice(set, get);
  const chrome = createChromeSlice<AdminKinds>(
    set as (partial: Partial<ChromeSlice<AdminKinds>>) => void,
    get as () => ChromeSlice<AdminKinds>,
    { defaults: APPEARANCE_DEFAULTS, defaultArea: "Connection" },
  );
  return {
    ...chrome,
    theme: APPEARANCE_DEFAULTS.theme,
    motion: APPEARANCE_DEFAULTS.motion,
    setTheme: (theme) => set({ theme }),
    setMotion: (motion) => set({ motion }),
    ...workspaceSlice(set, get),
    ...panesSlice(set, get),
    ...session,
    ...auditSlice(set, get),
    ...workSlice(set, get),
    ...createStaleSlice(set, get),
    ...createListQueriesSlice(set, get),
    ...tabSlices(set, get),
  };
});
