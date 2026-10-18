import { useCallback, useEffect, useRef, useState } from "react";
import { channelById } from "@/lib/channel-list";
import { createPreviewSession, SESSION_START, type PreviewSession } from "@/lib/preview-session";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { useChannelFlows } from "./useChannelFlows";

export interface PreviewSessionView {
  /** The channel as the last read holds it; undefined when it is gone (or before the first read). */
  readonly channel: AdminChannel | undefined;
  readonly reading: boolean;
  readonly attempt: number;
  readonly retry: () => void;
}

/** The Preview window's session over `GET /api/admin-channels` (`36` section 8): one read when the window opens, which
 *  replaces the channels slice, and one more for each `Retry`. The window finds its channel by id in the slice. */
export function usePreviewSession(channelId: string): PreviewSessionView {
  const flows = useChannelFlows();
  const [state, setState] = useState(SESSION_START);
  const session = useRef<PreviewSession | null>(null);
  const channel = useAppStore((store) => channelById(store.channels, channelId));

  useEffect(() => {
    const current = createPreviewSession(flows.refresh, setState);
    session.current = current;
    void current.open();
    return () => current.close();
  }, [flows]);

  const retry = useCallback(() => void session.current?.retry(), []);
  return { channel, reading: state.reading, attempt: state.attempt, retry };
}
