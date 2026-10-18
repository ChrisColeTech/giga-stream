import { useEffect } from "react";
import { preparingCount } from "@/lib/channel-list";
import { useAppStore } from "@/store/app-store";
import { useChannelFlows } from "./useChannelFlows";

/** The Channels page's lifecycle (`36` sections 5 and 5.4). It loads the channels when the tab is first shown after
 *  sign-in (status `idle`) and again when another tab's write marked them stale; never otherwise, and never on a timer.
 *  It writes the statusbar's `N preparing` (live rows `preparing`, `starting` or `restarting`) whenever the held list
 *  changes, which is exactly every load, write and delete. The page leaves with the session (the shell mounts no page
 *  while signed out), so leaving puts the tab's data and the count back to the start. */
export function useChannelsLoad(active: boolean): void {
  const flows = useChannelFlows();
  const status = useAppStore((state) => state.channels.status);
  const stale = useAppStore((state) => state.stale.channels);
  const items = useAppStore((state) => state.channels.items);
  const clearStale = useAppStore((state) => state.clearStale);
  const setWork = useAppStore((state) => state.setWork);

  useEffect(() => {
    if (!active || (status !== "idle" && !stale)) return;
    clearStale("channels");
    void flows.load();
  }, [active, status, stale, flows, clearStale]);

  useEffect(() => {
    setWork({ preparing: preparingCount(items) });
  }, [items, setWork]);

  useEffect(
    () => () => {
      const state = useAppStore.getState();
      state.channelsReset();
      state.setWork({ preparing: 0 });
    },
    [],
  );
}
