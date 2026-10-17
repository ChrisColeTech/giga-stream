import { DEFAULT_TAB } from "@/constants/tabs";
import type { Tab } from "@/types/shell";

/** The open workspace's record id per tab; null is the tab's index. Tabs are independent: opening one never touches the
 *  others, so returning to a tab finds it as it was left. */
export type WorkspaceMap = Readonly<Record<Tab, string | null>>;

export const NO_WORKSPACES: WorkspaceMap = {
  channels: null,
  providers: null,
  titles: null,
  playlists: null,
  jobs: null,
  accounts: null,
};

/* The tab and its workspaces, a slice of the one store. A forward verb or a link is a request: it switches the tab and
 * opens the named workspace, or the tab's index when it names none. Nothing here calls the backend. */
export interface WorkspaceSlice {
  tab: Tab;
  workspaces: WorkspaceMap;
  setTab: (tab: Tab) => void;
  openWorkspace: (tab: Tab, id: string) => void;
  closeWorkspace: (tab: Tab) => void;
  /** Forward verbs (`Titles →`) and links: show `tab`, on workspace `id` or on its index. */
  requestTab: (tab: Tab, id?: string) => void;
}

type Set = (partial: Partial<WorkspaceSlice>) => void;
type Get = () => WorkspaceSlice;

export function workspaceSlice(set: Set, get: Get): WorkspaceSlice {
  const withWorkspace = (tab: Tab, id: string | null): WorkspaceMap => ({ ...get().workspaces, [tab]: id });
  return {
    tab: DEFAULT_TAB,
    workspaces: NO_WORKSPACES,
    setTab: (tab) => set({ tab }),
    openWorkspace: (tab, id) => set({ workspaces: withWorkspace(tab, id) }),
    closeWorkspace: (tab) => set({ workspaces: withWorkspace(tab, null) }),
    requestTab: (tab, id) => set({ tab, workspaces: withWorkspace(tab, id ?? null) }),
  };
}
