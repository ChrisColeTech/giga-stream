import { useEffect, useState } from "react";
import { parseEpisodeCode } from "@/lib/player-format";
import { episodeDuringRefresh, playerDataRequestKey } from "@/lib/player-data-refresh";
import type { PlayerSession } from "@/lib/player-session";
import { readLocalMediaInfo, type LocalMediaInfo } from "@/services/local-media";
import { readRelated, readSeason, readTitle } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";
import type { Episode, TitleDetail } from "@/types/title";

export interface LoadedPlayerData {
  readonly item?: LibraryItem;
  readonly detail?: TitleDetail;
  readonly localInfo?: LocalMediaInfo;
  readonly playingEpisode?: Episode;
  readonly episodes: readonly Episode[];
  readonly related: readonly LibraryItem[];
  readonly basePending: boolean;
  readonly seasonPending: boolean;
  readonly playingPending: boolean;
  readonly relatedPending: boolean;
}

const EMPTY: LoadedPlayerData = {
  episodes: [], related: [], basePending: false, seasonPending: false, playingPending: false, relatedPending: false,
};
interface LoadedState extends LoadedPlayerData { readonly key: string; readonly playingKey?: string; }
const EMPTY_STATE: LoadedState = { ...EMPTY, key: "idle" };
const sentence = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

/** Reads only the one open item, its visible season, and its related row. */
export function usePlayerData(session: PlayerSession, revision = 0): LoadedPlayerData {
  const knownItems = useAppStore((state) => state.libraryItems);
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY_STATE);
  const tab = session.current;
  const key = tab === null ? "idle" : `${tab.ref.kind}:${tab.ref.id}`;
  const queried = knownItems.find((item) => tab !== null && item.ref.kind === tab.ref.kind && item.ref.id === tab.ref.id);
  const known = tab?.libraryItem ?? queried;
  const playing = parseEpisodeCode(tab?.subtitle);
  const playingKey = playing === undefined ? undefined : `${playing.season}:${playing.episode}`;
  const seasonRequest = playerDataRequestKey(key, String(session.season ?? 0), revision);
  const playingRequest = playerDataRequestKey(key, playingKey ?? "none", revision);

  useEffect(() => {
    if (tab === null) {
      setLoaded(EMPTY_STATE);
      return undefined;
    }
    const controller = new AbortController();
    setLoaded((current) => current.key === key
      ? { ...current, basePending: true, relatedPending: tab.ref.kind !== "local" }
      : {
          ...EMPTY,
          key,
          basePending: true,
          relatedPending: tab.ref.kind !== "local",
          ...(known === undefined ? {} : { item: known }),
        });
    if (tab.ref.kind === "local") {
      void readLocalMediaInfo(tab.ref.id, controller.signal).then((info) => {
        if (controller.signal.aborted) return;
        const item = known ?? {
          ref: tab.ref, kind: "local" as const, title: info.title, genres: [], favorite: false,
        };
        setLoaded({ ...EMPTY, key, item, localInfo: info });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded((current) => ({ ...current, basePending: false }));
          useAppStore.getState().say(sentence(error, "Local file information could not be read."), "warn");
        }
      });
    } else {
      void readTitle(tab.ref.id, controller.signal)
        .then((detail) => {
          if (controller.signal.aborted) return;
          const item = known ?? {
            ref: tab.ref, kind: detail.kind, title: detail.title, year: detail.year,
            posterUrl: detail.posterUrl, genres: detail.genres, favorite: false,
          };
          setLoaded((current) => ({ ...current, item, detail, basePending: false }));
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setLoaded((current) => ({ ...current, basePending: false }));
            useAppStore.getState().say(sentence(error, "Title information could not be read."), "warn");
          }
        });
      void readRelated(tab.ref.id, controller.signal).then((answer) => {
        if (controller.signal.aborted) return;
        setLoaded((current) => ({ ...current, related: answer.items, relatedPending: false }));
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded((current) => ({ ...current, relatedPending: false }));
          useAppStore.getState().say(sentence(error, "Related titles could not be read."), "warn");
        }
      });
    }
    return () => controller.abort();
  }, [tab?.ref.kind, tab?.ref.id, known, revision]);

  useEffect(() => {
    if (tab?.ref.kind !== "title" || tab.kind !== "tv" || session.season === undefined) return undefined;
    const controller = new AbortController();
    setLoaded((current) => ({ ...current, episodes: [], seasonPending: true }));
    void readSeason(tab.ref.id, session.season, controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      setLoaded((current) => ({ ...current, episodes: answer.episodes, seasonPending: false }));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoaded((current) => ({ ...current, seasonPending: false }));
        useAppStore.getState().say(sentence(error, "Episodes could not be read."), "warn");
      }
    });
    return () => controller.abort();
  }, [seasonRequest]);

  useEffect(() => {
    if (tab?.ref.kind !== "title" || tab.kind !== "tv" || playing === undefined) return undefined;
    const controller = new AbortController();
    setLoaded((current) => ({
      ...current,
      playingEpisode: episodeDuringRefresh(current.playingKey, playingKey, current.playingEpisode),
      playingKey,
      playingPending: true,
    }));
    void readSeason(tab.ref.id, playing.season, controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      const playingEpisode = answer.episodes.find((episode) => episode.episode === playing.episode);
      setLoaded((current) => ({ ...current, playingEpisode, playingKey, playingPending: false }));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoaded((current) => ({ ...current, playingPending: false }));
        useAppStore.getState().say(sentence(error, "Episode could not be read."), "warn");
      }
    });
    return () => controller.abort();
  }, [playingRequest]);

  /* The statusbar's bar reads the store (`50` section 2.3): the video is busy while any of this hook's pendings run
     or the stage is loading, and the flag clears on rest, failure and unmount alike. */
  const stageLoading = useAppStore((state) => state.playerMedia.stage.kind === "loading");
  const view: LoadedPlayerData = loaded.key !== key
    ? (tab === null ? EMPTY : { ...EMPTY, basePending: true, relatedPending: tab.ref.kind !== "local" })
    : loaded.playingKey === playingKey ? loaded : { ...loaded, playingEpisode: undefined };
  const pending = view.basePending || view.seasonPending || view.playingPending || view.relatedPending;
  useEffect(() => {
    useAppStore.getState().setActivity("video", pending || stageLoading);
    return () => useAppStore.getState().setActivity("video", false);
  }, [pending, stageLoading]);
  return view;
}
