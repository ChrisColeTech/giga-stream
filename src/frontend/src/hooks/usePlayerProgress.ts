import { useEffect, useRef } from "react";
import { PlayerProgress, ProgressBeginQueue, PROGRESS_INTERVAL_MS, type ProgressIdentity } from "@/lib/player-progress";
import { writeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";

export interface PlayerProgressControls {
  readonly begin: (identity: ProgressIdentity) => Promise<void>;
  readonly update: (positionMs: number, durationMs?: number) => void;
  readonly playing: (value: boolean) => void;
  readonly suspend: () => void;
  readonly checkpoint: () => Promise<void>;
  readonly flush: (reportFailure?: boolean) => Promise<void>;
}

/** Owns the 30-second cadence; media callbacks only report facts and lifecycle boundaries. */
export function usePlayerProgress(active: boolean): PlayerProgressControls {
  const session = useRef<PlayerProgress | null>(null);
  const begins = useRef(new ProgressBeginQueue());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlaying = useRef(false);
  const isActive = useRef(active);
  const pauseHistory = useAppStore((state) => state.library.pauseHistory);

  const stopTimer = () => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  };
  const writeNow = async (reportFailure = true) => {
    try {
      await session.current?.flush();
    } catch (error: unknown) {
      if (reportFailure) {
        useAppStore.getState().say(error instanceof Error ? error.message : "Watch progress could not be saved.", "warn");
      } else {
        throw error;
      }
    }
  };

  useEffect(() => {
    session.current?.setEnabled(!pauseHistory);
  }, [pauseHistory]);
  useEffect(() => {
    isActive.current = active;
    stopTimer();
    if (!active) void writeNow();
    else if (isPlaying.current) timer.current = setInterval(() => void writeNow(), PROGRESS_INTERVAL_MS);
  }, [active]);
  useEffect(() => () => {
    stopTimer();
    void writeNow();
  }, []);

  return {
    begin: async (identity) => {
      stopTimer();
      isPlaying.current = false;
      await begins.current.begin(writeNow, () => {
        session.current = new PlayerProgress(identity, !useAppStore.getState().library.pauseHistory, writeWatch);
      });
    },
    update: (positionMs, durationMs) => session.current?.update(positionMs, durationMs),
    playing: (value) => {
      isPlaying.current = value;
      stopTimer();
      if (value && isActive.current) timer.current = setInterval(() => void writeNow(), PROGRESS_INTERVAL_MS);
      else if (!value) void writeNow();
    },
    suspend: () => {
      isPlaying.current = false;
      stopTimer();
    },
    checkpoint: writeNow,
    flush: async (reportFailure = true) => {
      stopTimer();
      await writeNow(reportFailure);
    },
  };
}
