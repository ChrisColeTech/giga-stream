import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { EmbedHost } from "@/components/player/EmbedHost";
import { NativePlayer } from "@/components/player/NativePlayer";
import { PlayerSourceControl } from "@/components/player/PlayerSourceControl";
import { StageNote } from "@/components/player/StageNote";
import { collectionsSubmenu } from "@/lib/collection-menu";
import type { EmbedPlaybackEvent } from "@/lib/embed-messages";
import { openMenu } from "@/lib/menu";
import type { PlayerCommands } from "@/lib/player-commands";
import { LOCAL_MEDIA_FAILURE, STREAM_FAILURE } from "@/lib/player-copy";
import type { PlayerSource } from "@/lib/player-sources";
import { stageMenuItems } from "@/lib/player-stage-menu";
import type { PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";
import type { StageState } from "@/types/player";

export interface PlayerStageProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
  readonly sources: readonly PlayerSource[];
  readonly activeSource: PlayerSource | undefined;
  readonly selectedSourceId: string;
  readonly startPositionMs: number;
  readonly retry: number;
  readonly userInitiated: boolean;
  readonly onSource: (id: string) => void;
  readonly onState: (state: StageState) => void;
  readonly onProgress: (positionMs: number, durationMs?: number) => void;
  readonly onPlaying: (playing: boolean) => void;
  readonly onBoundary: () => void;
  readonly onPausedChange: (paused: boolean) => void;
}

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

/** One dark stage, hosting either the app player or a contained provider frame. */
export function PlayerStage(props: PlayerStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const pictureFit = useAppStore((state) => state.playback.pictureFit);
  const autoplay = useAppStore((state) => state.playback.autoplay);
  const subtitleLanguage = useAppStore((state) => state.playback.subtitleLanguage);
  const electron = useAppStore((state) => state.runtime) === "electron";

  useEffect(() => {
    const node = stageRef.current;
    if (node === null) return undefined;
    const sync = () => setFullscreen(document.fullscreenElement === node);
    node.addEventListener("fullscreenchange", sync);
    return () => node.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    const node = stageRef.current;
    if (node === null) return;
    if (document.fullscreenElement === node) void document.exitFullscreen().catch(() => undefined);
    else void node.requestFullscreen().catch(() => undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key !== "f" && event.key !== "F") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    toggleFullscreen();
  };

  const { tab, stage, item, favorite, memberIds, collections } = props.view;
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (tab === undefined) return;
    const watchId = item?.progress === undefined ? undefined : item.watchId;
    openMenu(event, stageMenuItems({
      fullscreen,
      favorite,
      collections: collectionsSubmenu(collections, (id) => memberIds.includes(id), props.commands.toggleMember),
      onRemoveHistory: watchId === undefined ? undefined : () => props.commands.removeHistory(watchId),
      onRetry: props.commands.retry,
      onFullscreen: toggleFullscreen,
      onReveal: props.commands.reveal,
      onFavorite: () => props.commands.favorite(!favorite),
      onClose: props.commands.close,
    }));
  };
  const embedPlayback = (event: EmbedPlaybackEvent) => {
    if (event.positionMs !== undefined) props.onProgress(event.positionMs, event.durationMs);
    if (event.event === "play" || event.event === "playing") {
      props.onPausedChange(false);
      props.onPlaying(true);
    }
    if (event.event === "pause") {
      props.onPausedChange(true);
      props.onPlaying(false);
    }
    if (event.event === "ended") {
      props.onPausedChange(true);
      props.onBoundary();
    }
  };

  return (
    <section ref={stageRef} tabIndex={-1} aria-label="Stage" onKeyDown={onKeyDown} onContextMenu={onContextMenu}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-stage outline-none fullscreen:bg-black">
      <PlayerSourceControl sources={props.sources} activeId={props.selectedSourceId} onSelect={props.onSource} />
      {props.activeSource?.kind === "embed" && (
        <EmbedHost source={props.activeSource.embed} positionMs={props.startPositionMs}
          subtitleLanguage={subtitleLanguage} electron={electron} retry={props.retry}
          onPlayback={embedPlayback} onReady={() => props.onState({ kind: "ready" })} />
      )}
      {props.activeSource?.kind === "stream" && tab !== undefined && (
        <NativePlayer url={props.activeSource.url} label={tab.title} positionMs={props.startPositionMs}
          autoplay={autoplay} userInitiated={props.userInitiated} retry={props.retry} pictureFit={pictureFit}
          errorReason={props.activeSource.id === "local" ? LOCAL_MEDIA_FAILURE : STREAM_FAILURE}
          onState={props.onState} onProgress={props.onProgress}
          onPlaying={(playing) => { props.onPausedChange(!playing); props.onPlaying(playing); }}
          onSeeked={props.onBoundary} onEnded={props.onBoundary} />
      )}
      {props.activeSource === undefined && (
        <video controls playsInline preload="none" aria-label={tab?.title ?? "Player"} className="size-full bg-stage" />
      )}
      {stage.kind === "failed" && <StageNote reason={stage.reason} onRetry={props.commands.retry} />}
    </section>
  );
}
