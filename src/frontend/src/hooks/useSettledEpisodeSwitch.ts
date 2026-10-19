import { useEffect, useState } from "react";
import {
  settleEpisodeSwitch, type EpisodeSwitchTarget, type PlayerNavigation,
} from "@/lib/player-navigation";
import type { PlayerProgressControls } from "@/hooks/usePlayerProgress";
import { useAppStore } from "@/store/app-store";

interface SettledEpisodeSwitch {
  readonly switching: boolean;
  readonly switchEpisode: (target: EpisodeSwitchTarget) => void;
}

/** One awaited latest-wins path for episode rows and footer adjacency controls. */
export function useSettledEpisodeSwitch(
  navigation: PlayerNavigation,
  progress: PlayerProgressControls,
  playbackKey: string,
  commit: (target: EpisodeSwitchTarget) => void,
): SettledEpisodeSwitch {
  const [switching, setSwitching] = useState(false);
  useEffect(() => setSwitching(false), [playbackKey]);
  return {
    switching,
    switchEpisode: (target) => {
      const generation = navigation.next();
      setSwitching(true);
      void settleEpisodeSwitch(
        navigation,
        generation,
        target,
        progress.flush(false),
        commit,
        (error) => useAppStore.getState().say(
          error instanceof Error ? error.message : "Watch progress could not be saved.", "warn",
        ),
      ).finally(() => {
        if (navigation.isLatest(generation)) setSwitching(false);
      });
    },
  };
}
