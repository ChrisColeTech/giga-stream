import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import type { EventArea } from "@/types/events";
import type { Tab } from "@/types/shell";

/** When the record a workspace shows is no longer in a read list (deleted elsewhere), closes the workspace and says so
 *  once on the notice line; `after` (a stable callback, such as the tab's Refresh) runs once as it closes. */
export function useWorkspaceGone(
  tab: Tab,
  gone: boolean,
  sentence: string,
  area: EventArea,
  after?: () => unknown,
): void {
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const say = useAppStore((state) => state.say);
  useEffect(() => {
    if (!gone) return;
    closeWorkspace(tab);
    say(sentence, "warn", area);
    void after?.();
  }, [gone, tab, sentence, area, after, closeWorkspace, say]);
}
