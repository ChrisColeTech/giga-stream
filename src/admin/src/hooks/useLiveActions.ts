import { refreshChannels, rememberLastChannel, retryStream } from "@/services/channels";
import type { ServiceResult } from "@/services/not-connected";
import { useAppStore } from "@/store/app-store";

export interface LiveActions {
  /** Reads the channel list again (the heading's Refresh and the no-channels note). */
  readonly refresh: () => void;
  /** Loads the failed stream's address again (the failed-stream note's Retry). */
  readonly retry: () => void;
  /** Tells the fileserver a channel is now playing, so Live opens on it next time. */
  readonly remember: (channelId: string) => void;
}

/** The Live surface's service calls, connected to the notice line. A refusal is reported once, as a warning; a success
 *  has nothing to report yet. */
export function useLiveActions(): LiveActions {
  const say = useAppStore((state) => state.say);

  const report = (result: ServiceResult) => {
    if (!result.ok) say(result.message, "warn");
  };

  return {
    refresh: () => report(refreshChannels()),
    retry: () => report(retryStream()),
    remember: (channelId) => report(rememberLastChannel(channelId)),
  };
}
