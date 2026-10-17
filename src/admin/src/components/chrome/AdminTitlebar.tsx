import { Tv } from "lucide-react";
import type { PaneToggleProps } from "@giga/ui/shell/PaneToggle";
import { Brand } from "@giga/ui/shell/Brand";
import { Titlebar } from "@giga/ui/shell/Titlebar";
import {
  EVENTS_TOGGLE_NAME,
  NO_LEFT_PANE,
  NO_RIGHT_PANE,
  SLEEPING_PANES,
  SLEEPING_TABS,
} from "@/constants/record-copy";
import { SIGN_IN_FIRST, TABS, TAB_PILL_LABEL } from "@/constants/tabs";
import { useAppStore } from "@/store/app-store";
import { usePaneOpen, useTab, useWorkSurfaceOpen, useWorkspaceOpen } from "@/store/selectors";
import type { Tab } from "@/types/shell";

/* The pill's items never change: the tab's label and its `Channels (Ctrl+1)` tooltip. */
const PILL_ITEMS = TABS.map((tab) => ({ id: tab.id, label: tab.label, title: tab.hint }));

/** The admin's titlebar: the library bar with its brand tagged `ADMIN`, the six-tab pill, the rail toggle (a workspace's
 *  rail, so disabled on an index), the Events toggle in the bottom toggle's place, and the right toggle, always disabled
 *  (`28` section 7.1). A modal window puts the tabs and the toggles to sleep; signed out, the tabs sleep with `Sign in
 *  first`. A toggle never leaves its place: disabled, with its reason. */
export function AdminTitlebar() {
  const tab = useTab();
  const signedIn = useAppStore((state) => state.signedIn);
  const eventsOpen = useAppStore((state) => state.eventsOpen);
  const toggleEvents = useAppStore((state) => state.toggleEvents);
  const togglePane = useAppStore((state) => state.togglePane);
  const setTab = useAppStore((state) => state.setTab);
  const asleep = useWorkSurfaceOpen();
  const hasRail = useWorkspaceOpen(tab);
  const railOpen = usePaneOpen(tab);

  const left: PaneToggleProps = {
    side: "left",
    lit: hasRail && railOpen && !asleep,
    reason: !hasRail ? NO_LEFT_PANE : asleep ? SLEEPING_PANES : undefined,
    onToggle: () => togglePane("left"),
  };
  const bottom: PaneToggleProps = {
    side: "bottom",
    name: EVENTS_TOGGLE_NAME,
    lit: eventsOpen && !asleep,
    reason: asleep ? SLEEPING_PANES : undefined,
    onToggle: toggleEvents,
  };
  const right: PaneToggleProps = { side: "right", lit: false, reason: NO_RIGHT_PANE, onToggle: () => undefined };

  return (
    <Titlebar<Tab>
      brand={<Brand word="GIGA" subtitle="STREAM" icon={Tv} tag="ADMIN" />}
      tabs={{
        label: TAB_PILL_LABEL,
        items: PILL_ITEMS,
        active: tab,
        disabled: asleep || !signedIn,
        disabledReason: signedIn ? SLEEPING_TABS : SIGN_IN_FIRST,
        onSelect: setTab,
      }}
      left={left}
      bottom={bottom}
      right={right}
    />
  );
}
