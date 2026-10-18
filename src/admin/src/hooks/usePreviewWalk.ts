import { useCallback, useRef, useState } from "react";
import { RETRY_READING } from "@/constants/preview-copy";
import { placeOf, walkReasons, walkStep, walkTotal, type WalkReasons } from "@/lib/preview-walk";
import { useAppStore } from "@/store/app-store";
import { useChannelFlows } from "./useChannelFlows";

export interface PreviewWalk {
  /** The place among the list's channels (1-based) and how many there are; null while the place is unknown. */
  readonly position: number | null;
  readonly total: number;
  readonly reasons: WalkReasons;
  readonly step: (direction: -1 | 1) => void;
}

/** Previous and Next (`36` section 8.1): the neighbour in the Channels list's own order. A neighbour on a page the list
 *  has not loaded is read through the list's own page read first. The old player detaches before the request value
 *  moves, so the new channel attaches on its own. One step runs at a time; the buttons say so while it does. */
export function usePreviewWalk(detach: () => void, reading: boolean): PreviewWalk {
  const flows = useChannelFlows();
  const channels = useAppStore((state) => state.channels);
  const [walking, setWalking] = useState(false);
  const running = useRef(false);

  const step = useCallback(
    async (direction: -1 | 1): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setWalking(true);
      try {
        const held = () => useAppStore.getState().channels;
        let next = walkStep(held(), direction);
        if (next.kind === "read") {
          await flows.readPage(next.page);
          next = walkStep(held(), direction);
        }
        if (next.kind !== "to") return;
        detach();
        useAppStore.getState().channelsStepPreview(next.row, next.at);
      } finally {
        running.current = false;
        setWalking(false);
      }
    },
    [flows, detach],
  );

  const reasons = walkReasons(channels);
  const busy = reading || walking ? RETRY_READING : undefined;
  const at = placeOf(channels);
  return {
    position: at === null ? null : at + 1,
    total: walkTotal(channels),
    reasons: { previous: reasons.previous ?? busy, next: reasons.next ?? busy },
    step: (direction) => {
      if (!reading) void step(direction);
    },
  };
}
