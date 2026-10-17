import { useEffect, useRef } from "react";
import { PlayerProgress, ProgressBeginQueue, type ProgressIdentity } from "@/lib/player-progress";
import { writeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";

export interface PlayerProgressControls {
  /** A new playback of `identity`, keyed by the Player's playback key. Flushes the previous one first. */
  readonly begin: (identity: ProgressIdentity, key: string) => Promise<void>;
  /** Play was pressed and the item can play: record it now at `positionMs`. Once per playback; ignored for a stale key. */
  readonly open: (key: string, positionMs: number) => void;
  /** Start over chosen: zero replaces the saved position. */
  readonly restart: () => void;
  /** A media or provider report; a write is sent only when one is due (media-time throttle, first duration). */
  readonly update: (positionMs: number, durationMs?: number) => void;
  /** The media started or stopped playing; a pause is a boundary. */
  readonly playing: (value: boolean) => void;
  readonly checkpoint: () => Promise<void>;
  readonly flush: (reportFailure?: boolean) => Promise<void>;
}

/**
 * Owns the recorder of the open playback and its page-lifecycle flushes (docs/30 section 3). There is no timer: a
 * write is caused by a media event, a provider message, or the page hiding or closing, and `pagehide` /
 * `visibilitychange` writes use `keepalive` so they finish after the window is gone. Boundary writes ask Library to
 * re-read, so Continue Watching and History change without a surface switch.
 */
export function usePlayerProgress(active: boolean): PlayerProgressControls {
  const session = useRef<PlayerProgress | null>(null);
  const begins = useRef(new ProgressBeginQueue());
  const failing = useRef(false);
  const pauseHistory = useAppStore((state) => state.library.pauseHistory);

  /** Runs one write; one notice per outage, not one per write. Throws only when the caller asked to see failures. */
  const settle = async (write: Promise<unknown> | undefined, refresh: boolean, reportFailure = true) => {
    if (write === undefined) return;
    try {
      await write;
      failing.current = false;
      if (refresh) useAppStore.getState().requestLibraryRefresh();
    } catch (error: unknown) {
      if (!reportFailure) throw error;
      if (failing.current) return;
      failing.current = true;
      useAppStore.getState().say(error instanceof Error ? error.message : "Watch progress could not be saved.", "warn");
    }
  };
  const flushNow = (reportFailure = true, keepalive = false) =>
    settle(session.current?.flush(keepalive), true, reportFailure);

  useEffect(() => {
    session.current?.setEnabled(!pauseHistory);
  }, [pauseHistory]);
  useEffect(() => {
    if (!active) void flushNow();
  }, [active]);
  useEffect(() => {
    // The window hiding or closing: the last position goes out with keepalive and nothing waits for the answer.
    const hide = () => void flushNow(true, true);
    const onVisibility = () => { if (document.visibilityState === "hidden") hide(); };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      void flushNow();
    };
  }, []);

  const record = (answer: Awaited<ReturnType<typeof writeWatch>>) => {
    if (answer.entry !== null) useAppStore.getState().rememberWatch(answer.entry);
    return answer;
  };
  return {
    begin: async (identity, key) => {
      await begins.current.begin(() => flushNow(), () => {
        session.current = new PlayerProgress(
          identity,
          !useAppStore.getState().library.pauseHistory,
          (write, keepalive) => writeWatch(write, { keepalive }).then(record),
          crypto.randomUUID(),
          key,
        );
      });
    },
    open: (key, positionMs) => {
      void begins.current.settled().then(() => {
        if (session.current?.key === key) return settle(session.current.open(positionMs), true);
        return undefined;
      });
    },
    restart: () => void settle(session.current?.restart(), true),
    update: (positionMs, durationMs) => void settle(session.current?.update(positionMs, durationMs), false),
    playing: (value) => { if (!value) void flushNow(); },
    checkpoint: () => flushNow(),
    flush: (reportFailure = true) => flushNow(reportFailure),
  };
}
