import { useCallback, useEffect, useRef, useState } from "react";
import { previewChannel } from "@/lib/channel-list";
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

/** The Preview window's session (`36` section 8.2): ONE read of THE channel (`GET /api/admin/channels/:id`) when the
 *  window opens and one more for each `Retry`; a step to a channel the list does not hold, or to a live one, reads that one
 *  channel too, in the background. The list is never read and its pages never dropped: the answer goes in by id. */
export function usePreviewSession(channelId: string): PreviewSessionView {
  const flows = useChannelFlows();
  const [state, setState] = useState(SESSION_START);
  const session = useRef<PreviewSession | null>(null);
  const current = useRef(channelId);
  current.current = channelId;
  const channel = useAppStore((store) => previewChannel(store.channels, channelId));
  const covered = useRef(channelId); // the channel the open's own read is for

  useEffect(() => {
    const made = createPreviewSession(() => flows.readOne(current.current), setState);
    session.current = made;
    void made.open();
    return () => made.close();
  }, [flows]);

  /* A step: the held row shows at once; a live one (its state moves) or one the list does not hold is read afresh. */
  useEffect(() => {
    if (covered.current === channelId) return;
    covered.current = channelId;
    const held = previewChannel(useAppStore.getState().channels, channelId);
    if (held === undefined || held.kind === "live") void flows.readOne(channelId);
  }, [channelId, flows]);

  const retry = useCallback(() => void session.current?.retry(), []);
  return { channel, reading: state.reading, attempt: state.attempt, retry };
}
