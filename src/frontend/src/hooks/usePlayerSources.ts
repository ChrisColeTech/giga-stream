import { useEffect, useMemo } from "react";
import type { LoadedPlayerData } from "@/hooks/usePlayerData";
import type { PlayerSession } from "@/lib/player-session";
import { localSource, playableSources, sameSources, selectedPlayerSource, type PlayerSource } from "@/lib/player-sources";
import { localMediaAddress } from "@/services/local-media";
import { useAppStore } from "@/store/app-store";

/** Resolves media for the playing item and preserves a session source choice across same-item refreshes. */
export function usePlayerSources(session: PlayerSession, data: LoadedPlayerData): readonly PlayerSource[] {
  const setSources = useAppStore((state) => state.setPlayerSources);
  const sources = useMemo(() => {
    if (session.current?.kind === "local") {
      return data.localInfo?.playable === true ? [localSource(localMediaAddress(session.current.ref.id))] : [];
    }
    if (session.current?.kind === "tv") {
      return playableSources(data.playingEpisode?.sources, data.playingEpisode?.streamUrl);
    }
    return playableSources(data.detail?.sources, data.detail?.streamUrl);
  }, [data.detail, data.localInfo, data.playingEpisode, session.current]);

  useEffect(() => {
    // The saved default when this item offers it, else its first source. Read here, not as a dependency: choosing a
    // source must not restart the stage it just switched.
    const saved = useAppStore.getState().playback.defaultSource;
    const selected = selectedPlayerSource(sources, saved)?.id ?? null;
    const current = useAppStore.getState().playerMedia;
    // An identity-only recompute (a re-read answering the same media) writes nothing: the stage would be forced
    // back to `loading`, which no media event then advances while the mounted element keeps playing.
    if (current.activeSourceId === selected && sameSources(current.sources, sources)) return;
    setSources(sources, selected);
  }, [sources]);
  return sources;
}
