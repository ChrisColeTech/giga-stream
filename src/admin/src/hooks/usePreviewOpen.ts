import { useCallback } from "react";
import { useAppStore } from "@/store/app-store";

/** `Preview →` (`36` section 8): the channels slice takes the request value (the channel and a raised serial), then the
 *  one open flow becomes `preview`, replacing Settings if it was open. The window reads the channel afresh itself. */
export function usePreviewOpen(): (channelId: string) => void {
  return useCallback((channelId: string) => {
    const state = useAppStore.getState();
    state.channelsOpenPreview(channelId);
    state.openOverlay("preview");
  }, []);
}
