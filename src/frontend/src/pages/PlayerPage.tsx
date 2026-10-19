import { useEffect, useReducer, useRef, useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { PlayerBrowser } from "@/components/player/PlayerBrowser";
import { PlayerInspector } from "@/components/player/PlayerInspector";
import { PlayerRelated } from "@/components/player/PlayerRelated";
import { PlayerStage } from "@/components/player/PlayerStage";
import { changeFavourite, changeMembership, removeWatchEntry } from "@/components/library/library-service";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useEpisodeAdjacency } from "@/hooks/useEpisodeAdjacency";
import { usePlayerProgress } from "@/hooks/usePlayerProgress";
import { usePlayerResume } from "@/hooks/usePlayerResume";
import { usePlayerSources } from "@/hooks/usePlayerSources";
import { useSettledEpisodeSwitch } from "@/hooks/useSettledEpisodeSwitch";
import { collectionRow } from "@/lib/collections-model";
import { itemKey } from "@/lib/library-marks";
import type { PlayerCommands } from "@/lib/player-commands";
import { BACKEND_UNREACHABLE_REASON, sourceFailureReason } from "@/lib/player-copy";
import { reportedDuration } from "@/lib/player-opening";
import { PlayerNavigation, settleLatestNavigation } from "@/lib/player-navigation";
import { settleFinalProgress } from "@/lib/player-progress";
import { selectedPlayerSource } from "@/lib/player-sources";
import {
  createPlayerSession, fallbackPlayerItem, isOpen, itemFromLibrary, playerPlaybackKey,
  playingEpisodeOf, reducePlayerSession,
} from "@/lib/player-session";
import { resumeOf, viewOf } from "@/lib/player-view";
import { withWatchMark } from "@/lib/watch-marks";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";
export function PlayerPage({ active }: { active: boolean }) {
  const [session, dispatch] = useReducer(reducePlayerSession, createPlayerSession(null));
  const [retry, setRetry] = useState(0); const [dataRetry, setDataRetry] = useState(0);
  const [userInitiated, setUserInitiated] = useState(false);
  const handled = useRef(0); const navigation = useRef(new PlayerNavigation());
  const data = usePlayerData(session, dataRetry); const progress = usePlayerProgress(active);
  const marks = useAppStore((state) => state.marks);
  const collections = useAppStore((state) => state.collections).map(collectionRow);
  const libraryItems = useAppStore((state) => state.libraryItems);
  const media = useAppStore((state) => state.playerMedia);
  /* The paused flag lives in the store (`50` section 2.4): the statusbar's Stop reads it while the page shows it. */
  const paused = useAppStore((state) => state.playerPaused);
  const setPaused = useAppStore((state) => state.setPlayerPaused);
  const mark = useAppStore((state) => session.current === null ? undefined : state.watchMarks[itemKey(session.current.ref)]);
  const setPlayerItem = useAppStore((state) => state.setPlayerItem);
  const setSources = useAppStore((state) => state.setPlayerSources);
  const setSource = useAppStore((state) => state.setPlayerSource);
  const setPlayback = useAppStore((state) => state.setPlayback);
  const defaultSource = useAppStore((state) => state.playback.defaultSource);
  const setStage = useAppStore((state) => state.setPlayerStage);
  const setSurface = useAppStore((state) => state.setSurface);
  const requestLibrary = useAppStore((state) => state.requestLibrary);
  /* What this session wrote or removed is newer than the item's snapshot, so Resume and the markers read it first. */
  const view = viewOf(session, marks, {
    item: withWatchMark(data.item ?? session.current?.libraryItem, mark),
    detail: data.detail,
    local: data.localInfo === undefined ? undefined : { info: data.localInfo },
    episodes: data.episodes,
    related: data.related,
    collections,
    stage: media.stage,
  });
  const playing = playingEpisodeOf(session);
  const adjacency = useEpisodeAdjacency(view, data, playing);
  const sources = usePlayerSources(session, data);
  const activeSource = selectedPlayerSource(sources, defaultSource);
  const stageView = activeSource?.id === media.activeSourceId ? view : { ...view, stage: { kind: "loading" } as const };
  const playbackKey = playerPlaybackKey(session);
  const episodeSwitch = useSettledEpisodeSwitch(navigation.current, progress, playbackKey, (target) => {
    dispatch({ type: "episode", season: target.season, episode: target.episode });
    setPaused(true);
    setUserInitiated(true);
  });
  const liveResume = resumeOf(view);
  const resume = usePlayerResume(playbackKey, liveResume);
  const hostedSource = resume.waiting ? undefined : activeSource;
  const playableUnitResolved = session.current?.kind === "local"
    ? data.localInfo !== undefined
    : session.current?.kind === "tv" ? data.playingEpisode !== undefined : data.detail !== undefined;
  const stageLoading = (data.basePending
    || (session.current?.kind === "tv" && playing !== undefined && data.playingPending)) && sources.length === 0;
  const browserLoading = data.basePending || data.seasonPending;
  const noSourceReason = sourceFailureReason(session.current?.kind === "local",
    data.localInfo?.error?.message ?? (data.detail?.fromCache === true ? BACKEND_UNREACHABLE_REASON : undefined));
  const runtimeMs = session.current?.kind === "tv" ? data.playingEpisode?.runtimeMs : data.detail?.runtimeMs;
  const openItem = async (item: LibraryItem) => {
    const generation = navigation.current.next();
    if (isOpen(session, item.ref)) return;
    const latest = await settleLatestNavigation(navigation.current, generation, progress.flush(false), (error) => {
      useAppStore.getState().say(error instanceof Error ? error.message : "Watch progress could not be saved.", "warn");
    });
    if (!latest) return;
    const next = itemFromLibrary(item);
    dispatch({ type: "open", item: next });
    setPlayerItem(next);
    setPaused(true);
    setUserInitiated(true);
  };
  const playRequest = useAppStore((state) => state.playRequest);
  useEffect(() => {
    if (playRequest === null || playRequest.serial === handled.current) return;
    handled.current = playRequest.serial;
    const item = libraryItems.find((row) => row.ref.kind === playRequest.ref.kind && row.ref.id === playRequest.ref.id);
    void openItem(item ?? fallbackPlayerItem(playRequest.ref));
  }, [playRequest, libraryItems]);
  useEffect(() => {
    if (session.current?.kind === "tv" && session.season === undefined && data.detail?.seasons?.[0] !== undefined) {
      dispatch({ type: "season", season: data.detail.seasons[0].season });
    }
  }, [data.detail, session.current, session.season]);

  /* A playback is the open item with its exact episode. It starts recording when it begins, and Play writes the entry
   * as soon as the item has a source it can play: an item with nothing to play never enters History. */
  useEffect(() => {
    setPaused(true);
    if (session.current === null || (session.current.kind === "tv" && playing === undefined)) return;
    void progress.begin({
      item: session.current.ref,
      ...(playing === undefined ? {} : { season: playing.season, episode: playing.episode }),
    }, playbackKey);
  }, [playbackKey]);
  const playable = sources.length > 0;
  useEffect(() => {
    if (playable) progress.open(playbackKey, resume.openingMs);
  }, [playbackKey, playable]);

  useEffect(() => {
    if (session.current === null || (session.current.kind === "tv" && playing === undefined) || !playableUnitResolved) return;
    if (sources.length === 0) setStage({ kind: "failed", reason: noSourceReason });
  }, [data.detail, data.localInfo, data.playingEpisode, playbackKey, sources.length]);

  const close = async () => {
    const generation = navigation.current.next();
    await settleFinalProgress(progress.flush());
    navigation.current.commitLatest(generation, () => {
      dispatch({ type: "close" });
      setPlayerItem(null);
      setSources([], null);
    });
  };
  const chooseEpisode = (season: number, episode: number) => episodeSwitch.switchEpisode({ season, episode });
  const commands: PlayerCommands = {
    retry: () => {
      void progress.checkpoint();
      setDataRetry((value) => value + 1);
      resume.hold();
      setUserInitiated(true);
      setRetry((value) => value + 1);
    },
    reveal: () => session.current === null ? setSurface("library") : requestLibrary({ select: session.current.ref }),
    close: () => void close(),
    resume: () => {
      resume.resume(liveResume?.positionMs ?? 0);
      setUserInitiated(true);
      setRetry((value) => value + 1);
    },
    startOver: () => {
      resume.startOver();
      progress.restart();
      setUserInitiated(true);
      setRetry((value) => value + 1);
    },
    favorite: (value) => { if (session.current !== null) void changeFavourite(session.current.ref, value); },
    toggleMember: (id) => {
      if (session.current !== null) changeMembership(session.current.ref, id, !view.memberIds.includes(id), view.memberIds);
    },
    removeHistory: (id) => void removeWatchEntry(id),
    openRelated: (item) => { void openItem(item); },
  };

  return <WorkspaceSplit surface="player" active={active}
    left={<PlayerBrowser view={view} loading={browserLoading}
      onSeason={(season) => dispatch({ type: "season", season })} onEpisode={chooseEpisode} />}
    center={<PlayerStage view={stageView} commands={commands} activeSource={hostedSource}
      startPositionMs={resume.startPositionMs} retry={retry} userInitiated={userInitiated}
      loading={stageLoading} awaitingResume={resume.waiting}
      playableUnitSelected={session.current?.kind !== "tv" || playing !== undefined}
      playableUnitResolved={playableUnitResolved} noSourceReason={noSourceReason}
      onState={setStage}
      onProgress={(position, duration) => {
        resume.track(position);
        progress.update(position, reportedDuration(duration, activeSource, runtimeMs));
      }} onPlaying={progress.playing} onBoundary={() => void progress.checkpoint()}
      onPausedChange={setPaused} />}
    right={<PlayerInspector view={view} commands={commands} paused={paused}
      sources={sources} activeId={activeSource?.id ?? ""} activeSource={activeSource}
      adjacency={adjacency} switchingEpisode={episodeSwitch.switching} onEpisode={chooseEpisode} onSelect={(id) => {
        void progress.flush();
        resume.hold();
        setSource(id);
        setPlayback({ defaultSource: id }); // the choice is the saved default (docs/31)
        setUserInitiated(true);
      }}
      loading={data.basePending && data.detail === undefined && data.localInfo === undefined} />}
    bottom={<PlayerRelated view={view} commands={commands} loading={data.relatedPending && data.related.length === 0} />} />;
}
