import { useEffect, useReducer, useRef, useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { PlayerBrowser } from "@/components/player/PlayerBrowser";
import { PlayerInspector } from "@/components/player/PlayerInspector";
import { PlayerRelated } from "@/components/player/PlayerRelated";
import { PlayerStage } from "@/components/player/PlayerStage";
import { changeFavourite, changeMembership } from "@/components/library/library-service";
import { usePlayerData } from "@/hooks/usePlayerData";
import { usePlayerProgress } from "@/hooks/usePlayerProgress";
import { usePlayerSources } from "@/hooks/usePlayerSources";
import { collectionRow } from "@/lib/collections-model";
import type { PlayerCommands } from "@/lib/player-commands";
import { sourceFailureReason } from "@/lib/player-copy";
import { openingPosition } from "@/lib/player-opening";
import { PlayerNavigation, settleLatestNavigation } from "@/lib/player-navigation";
import { settleFinalProgress } from "@/lib/player-progress";
import {
  createPlayerSession, fallbackPlayerItem, isOpen, itemFromLibrary, playerPlaybackKey,
  playingEpisodeOf, reducePlayerSession,
} from "@/lib/player-session";
import { resumeOf, viewOf } from "@/lib/player-view";
import { removeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";

export function PlayerPage({ active }: { active: boolean }) {
  const [session, dispatch] = useReducer(reducePlayerSession, createPlayerSession(null));
  const [paused, setPaused] = useState(true);
  const [retry, setRetry] = useState(0); const [dataRetry, setDataRetry] = useState(0);
  const [choice, setChoice] = useState<"ask" | "resume" | "restart">("ask");
  const [userInitiated, setUserInitiated] = useState(false);
  const handled = useRef(0); const navigation = useRef(new PlayerNavigation());
  const currentPosition = useRef(0);
  const [sourcePosition, setSourcePosition] = useState(0);
  const data = usePlayerData(session, dataRetry);
  const progress = usePlayerProgress(active);
  const marks = useAppStore((state) => state.marks);
  const collections = useAppStore((state) => state.collections).map(collectionRow);
  const libraryItems = useAppStore((state) => state.libraryItems);
  const media = useAppStore((state) => state.playerMedia);
  const resumeMode = useAppStore((state) => state.playback.resumeMode);
  const setPlayerItem = useAppStore((state) => state.setPlayerItem);
  const setSources = useAppStore((state) => state.setPlayerSources);
  const setSource = useAppStore((state) => state.setPlayerSource);
  const setStage = useAppStore((state) => state.setPlayerStage);
  const setSurface = useAppStore((state) => state.setSurface);
  const requestLibrary = useAppStore((state) => state.requestLibrary);
  const view = viewOf(session, marks, {
    item: data.item,
    detail: data.detail,
    local: data.localInfo === undefined ? undefined : { info: data.localInfo },
    episodes: data.episodes,
    related: data.related,
    collections,
    stage: media.stage,
  });
  const playing = playingEpisodeOf(session);
  const sources = usePlayerSources(session, data);
  const activeSource = sources.find((source) => source.id === media.activeSourceId);
  const resume = resumeOf(view);
  const hostedSource = choice === "ask" && resume !== undefined ? undefined : activeSource;
  const waitingForResume = choice === "ask" && resume !== undefined;
  const stageLoading = (data.basePending
    || (session.current?.kind === "tv" && playing !== undefined && data.playingPending)) && sources.length === 0;
  const browserLoading = data.basePending || data.seasonPending;
  const noSourceReason = sourceFailureReason(session.current?.kind === "local", data.localInfo?.error?.message);
  const startPositionMs = choice === "resume" ? sourcePosition : 0;
  const playbackKey = playerPlaybackKey(session);

  const openItem = async (item: LibraryItem) => {
    const generation = navigation.current.next();
    if (isOpen(session, item.ref)) return;
    progress.suspend();
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

  useEffect(() => {
    setChoice(resumeMode === "ask" ? "ask" : resumeMode);
    const opening = openingPosition(resumeMode, resume);
    currentPosition.current = opening;
    setSourcePosition(opening);
    setPaused(true);
    if (session.current === null || (session.current.kind === "tv" && playing === undefined)) return;
    void progress.begin({
      item: session.current.ref,
      ...(playing === undefined ? {} : { season: playing.season, episode: playing.episode }),
    });
  }, [playbackKey]);

  useEffect(() => {
    if (session.current === null || (session.current.kind === "tv" && playing === undefined)) return;
    const ready = session.current.kind === "local"
      ? data.localInfo !== undefined
      : session.current.kind === "tv" ? data.playingEpisode !== undefined : data.detail !== undefined;
    if (!ready) return;
    if (sources.length === 0) {
      const reason = sourceFailureReason(session.current.kind === "local", data.localInfo?.error?.message);
      setStage({ kind: "failed", reason });
    }
  }, [data.detail, data.localInfo, data.playingEpisode, playbackKey, sources.length]);

  const close = async () => {
    const generation = navigation.current.next();
    progress.suspend();
    await settleFinalProgress(progress.flush());
    navigation.current.commitLatest(generation, () => {
      dispatch({ type: "close" });
      setPlayerItem(null);
      setSources([], null);
    });
  };
  const chooseEpisode = (season: number, number: number) => {
    dispatch({ type: "episode", season, episode: number });
    setUserInitiated(true);
  };
  const commands: PlayerCommands = {
    retry: () => {
      void progress.checkpoint();
      setDataRetry((value) => value + 1);
      setSourcePosition(currentPosition.current);
      setUserInitiated(true);
      setRetry((value) => value + 1);
    },
    reveal: () => session.current === null ? setSurface("library") : requestLibrary({ select: session.current.ref }),
    close: () => void close(),
    resume: () => {
      const position = resume?.positionMs ?? 0;
      currentPosition.current = position;
      setSourcePosition(position);
      setChoice("resume");
      setUserInitiated(true);
      setRetry((value) => value + 1);
    },
    startOver: () => {
      currentPosition.current = 0;
      setSourcePosition(0);
      setChoice("restart");
      setUserInitiated(true);
      setRetry((value) => value + 1);
    },
    favorite: (value) => { if (session.current !== null) void changeFavourite(session.current.ref, value); },
    toggleMember: (id) => {
      if (session.current !== null) changeMembership(session.current.ref, id, !view.memberIds.includes(id), view.memberIds);
    },
    removeHistory: (id) => {
      void removeWatch(id).catch((error: unknown) => useAppStore.getState().say(
        error instanceof Error ? error.message : "History could not be changed.", "warn",
      ));
    },
    openRelated: (item) => { void openItem(item); },
  };

  return <WorkspaceSplit surface="player" active={active}
    left={<PlayerBrowser view={view} loading={browserLoading}
      onSeason={(season) => dispatch({ type: "season", season })} onEpisode={chooseEpisode} />}
    center={<PlayerStage view={view} commands={commands} sources={sources} activeSource={hostedSource}
      selectedSourceId={media.activeSourceId ?? ""}
      startPositionMs={startPositionMs} retry={retry} userInitiated={userInitiated}
      loading={stageLoading} awaitingResume={waitingForResume} noSourceReason={noSourceReason}
      onSource={(id) => {
        void progress.flush();
        setSourcePosition(currentPosition.current);
        setSource(id);
        setUserInitiated(true);
      }} onState={setStage}
      onProgress={(position, duration) => {
        currentPosition.current = position;
        progress.update(position, duration);
      }} onPlaying={progress.playing} onBoundary={() => void progress.checkpoint()}
      onPausedChange={setPaused} />}
    right={<PlayerInspector view={view} commands={commands} paused={paused}
      loading={data.basePending && data.detail === undefined && data.localInfo === undefined} />}
    bottom={<PlayerRelated view={view} commands={commands} loading={data.relatedPending && data.related.length === 0} />} />;
}
