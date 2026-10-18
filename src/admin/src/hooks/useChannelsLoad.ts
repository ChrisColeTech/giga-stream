import { useEffect } from "react";
import { preparingCount } from "@/lib/channel-list";
import { useAppStore } from "@/store/app-store";
import { useChannelFlows } from "./useChannelFlows";

/** The Channels page's lifecycle (`36` sections 5 and 5.4, `41` section 4.3). It reads the first page when the tab is
 *  first shown after sign-in (status `idle`) and, when another tab's write marked the channels stale, drops the pages so
 *  the window reads what it shows again; never otherwise, and never on a timer. It writes the statusbar's `N preparing`
 *  (live rows `preparing`, `starting` or `restarting`, counted over the live rows read apart from the list) whenever
 *  they change, which is exactly every load, write and delete. The page leaves with the session (the shell mounts no page
 *  while signed out), so leaving puts the tab's data and the count back to the start. */
export function useChannelsLoad(active: boolean): void {
  const flows = useChannelFlows();
  const status = useAppStore((state) => state.channels.status);
  const stale = useAppStore((state) => state.stale.channels);
  const live = useAppStore((state) => state.channels.live);
  const clearStale = useAppStore((state) => state.clearStale);
  const setWork = useAppStore((state) => state.setWork);

  useEffect(() => {
    if (!active || (status !== "idle" && !stale)) return;
    clearStale("channels");
    void (status === "idle" ? flows.load() : flows.refresh());
  }, [active, status, stale, flows, clearStale]);

  useEffect(() => {
    setWork({ preparing: preparingCount(live) });
  }, [live, setWork]);

  useEffect(
    () => () => {
      const state = useAppStore.getState();
      state.channelsReset();
      state.setWork({ preparing: 0 });
    },
    [],
  );
}
