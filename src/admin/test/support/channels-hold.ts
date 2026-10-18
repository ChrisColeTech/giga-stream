import { queryKey } from "@/lib/channel-query";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";

/** The tab holding these rows as its first page (a list of at most one page), as a first read leaves it. Test setup. */
export function holdChannels(items: readonly AdminChannel[], revision = 1): void {
  const state = useAppStore.getState();
  state.channelsPageLoaded(queryKey(state.channels.query), 0, items, items.length, revision);
}
