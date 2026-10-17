import { useEffect, useRef, useState } from "react";
import { openingPosition } from "@/lib/player-opening";
import { useAppStore } from "@/store/app-store";
import type { Progress } from "@/types/library";

type Choice = "ask" | "resume" | "restart";

export interface PlayerResume {
  /** Where the item was left when this playback opened; it does not move while the item plays. */
  readonly point: Progress | undefined;
  /** The stage waits for Resume or Start over: the setting asks, and there is a position to ask about. */
  readonly waiting: boolean;
  /** Where the app's own media starts. */
  readonly startPositionMs: number;
  /** Where the item will start from, for the history entry Play creates. */
  readonly openingMs: number;
  /** The newest playback position the media or a provider reported. */
  readonly track: (positionMs: number) => void;
  /** Keep the current position through a reload (Retry, a source switch). */
  readonly hold: () => void;
  readonly resume: (positionMs: number) => void;
  readonly startOver: () => void;
}

/**
 * The Resume / Start over decision of one playback (`docs/06` section 5). The saved position is read once when the
 * playback opens: progress written during playback keeps changing the item's live progress, and a decision that
 * followed it would unmount the stage mid-play (docs/30 section 3.3).
 */
export function usePlayerResume(playbackKey: string, live: Progress | undefined): PlayerResume {
  const mode = useAppStore((state) => state.playback.resumeMode);
  const frozen = useRef<{ readonly key: string; readonly point: Progress | undefined } | null>(null);
  if (frozen.current?.key !== playbackKey) frozen.current = { key: playbackKey, point: live };
  const point = frozen.current.point;
  const [choice, setChoice] = useState<Choice>("ask");
  const [sourcePosition, setSourcePosition] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    setChoice(mode);
    const opening = openingPosition(mode, point);
    current.current = opening;
    setSourcePosition(opening);
  }, [playbackKey]);

  const pick = (next: Choice, positionMs: number) => {
    current.current = positionMs;
    setSourcePosition(positionMs);
    setChoice(next);
  };
  return {
    point,
    waiting: choice === "ask" && point !== undefined,
    startPositionMs: choice === "resume" ? sourcePosition : 0,
    openingMs: mode === "restart" ? 0 : (point?.positionMs ?? 0),
    track: (positionMs) => { current.current = positionMs; },
    hold: () => setSourcePosition(current.current),
    resume: (positionMs) => pick("resume", positionMs),
    startOver: () => pick("restart", 0),
  };
}
