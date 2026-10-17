import { useEffect, useState } from "react";
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
  readonly episodes: readonly Episode[];
  readonly related: readonly LibraryItem[];
}

const EMPTY: LoadedPlayerData = { episodes: [], related: [] };
interface LoadedState extends LoadedPlayerData { readonly key: string; }
const EMPTY_STATE: LoadedState = { ...EMPTY, key: "idle" };
const sentence = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

/** Reads only the one open item, its visible season, and its related row. */
export function usePlayerData(session: PlayerSession, revision = 0): LoadedPlayerData {
  const knownItems = useAppStore((state) => state.libraryItems);
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY_STATE);
  const tab = session.current;
  const key = tab === null ? "idle" : `${tab.ref.kind}:${tab.ref.id}`;
  const known = knownItems.find((item) => tab !== null && item.ref.kind === tab.ref.kind && item.ref.id === tab.ref.id);

  useEffect(() => {
    if (tab === null) {
      setLoaded(EMPTY_STATE);
      return undefined;
    }
    const controller = new AbortController();
    setLoaded({ ...EMPTY, key, ...(known === undefined ? {} : { item: known }) });
    if (tab.ref.kind === "local") {
      void readLocalMediaInfo(tab.ref.id, controller.signal).then((info) => {
        const item = known ?? {
          ref: tab.ref, kind: "local" as const, title: info.title, genres: [], favorite: false,
        };
        setLoaded({ key, item, localInfo: info, episodes: [], related: [] });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) useAppStore.getState().say(sentence(error, "Local file information could not be read."), "warn");
      });
    } else {
      void readTitle(tab.ref.id, controller.signal)
        .then((detail) => {
          const item = known ?? {
            ref: tab.ref, kind: detail.kind, title: detail.title, year: detail.year,
            posterUrl: detail.posterUrl, genres: detail.genres, favorite: false,
          };
          setLoaded((current) => ({ ...current, item, detail }));
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) useAppStore.getState().say(sentence(error, "Title information could not be read."), "warn");
        });
      void readRelated(tab.ref.id, controller.signal).then((answer) => {
        setLoaded((current) => ({ ...current, related: answer.items }));
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) useAppStore.getState().say(sentence(error, "Related titles could not be read."), "warn");
      });
    }
    return () => controller.abort();
  }, [tab?.ref.kind, tab?.ref.id, known, revision]);

  useEffect(() => {
    if (tab?.ref.kind !== "title" || tab.kind !== "tv" || session.season === undefined) return undefined;
    const controller = new AbortController();
    setLoaded((current) => ({ ...current, episodes: [] }));
    void readSeason(tab.ref.id, session.season, controller.signal).then((answer) => {
      setLoaded((current) => ({ ...current, episodes: answer.episodes }));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) useAppStore.getState().say(sentence(error, "Episodes could not be read."), "warn");
    });
    return () => controller.abort();
  }, [session.season, tab?.kind, tab?.ref.kind, tab?.ref.id]);

  if (loaded.key !== key) return EMPTY;
  return loaded;
}
