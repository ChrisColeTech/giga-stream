import { useEffect, useMemo } from "react";
import type { LoadedPlayerData } from "@/hooks/usePlayerData";
import type { PlayerSession } from "@/lib/player-session";
import { localSource, playableSources, selectedPlayerSource, type PlayerSource } from "@/lib/player-sources";
import { localMediaAddress } from "@/services/local-media";
import { useAppStore } from "@/store/app-store";

/** Resolves media for the playing item and preserves a session source choice across same-item refreshes. */
export function usePlayerSources(session: PlayerSession, data: LoadedPlayerData): readonly PlayerSource[] {
  const activeSourceId = useAppStore((state) => state.playerMedia.activeSourceId);
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
    const selected = selectedPlayerSource(sources, activeSourceId)?.id ?? null;
    setSources(sources, selected);
  }, [sources]);
  return sources;
}
