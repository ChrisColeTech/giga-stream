import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { EmbedHost } from "@/components/player/EmbedHost";
import { NativePlayer } from "@/components/player/NativePlayer";
import { PlayerStageStatus } from "@/components/player/PlayerStageStatus";
import { StageNote } from "@/components/player/StageNote";
import { collectionsSubmenu } from "@/lib/collection-menu";
import { applyEmbedPlayback } from "@/lib/embed-playback";
import { objectFitOf } from "@/lib/live-picture";
import { openMenu } from "@/lib/menu";
import type { PlayerCommands } from "@/lib/player-commands";
import { LOCAL_MEDIA_FAILURE, STREAM_FAILURE } from "@/lib/player-copy";
import { playerStageRender } from "@/lib/player-render-state";
import type { PlayerSource } from "@/lib/player-sources";
import { stageMenuItems } from "@/lib/player-stage-menu";
import type { PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";
import type { StageState } from "@/types/player";

export interface PlayerStageProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
  readonly activeSource: PlayerSource | undefined;
  readonly startPositionMs: number;
  readonly retry: number;
  readonly userInitiated: boolean;
  readonly loading: boolean;
  readonly awaitingResume: boolean;
  readonly playableUnitSelected: boolean;
  readonly playableUnitResolved: boolean;
  readonly noSourceReason: string;
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
  const electron = typeof window !== "undefined" && window.pocHost?.runtime === "electron";

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
  const render = playerStageRender(
    tab !== undefined,
    props.loading,
    props.activeSource,
    stage,
    props.awaitingResume,
    props.playableUnitSelected,
    props.playableUnitResolved,
  );
  const hasMediaHost = render === "native" || render === "native-failed"
    || render === "embed" || render === "embed-failed";
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
  const embedPlayback = (event: Parameters<typeof applyEmbedPlayback>[0]) => applyEmbedPlayback(event, {
    progress: props.onProgress,
    paused: props.onPausedChange,
    playing: props.onPlaying,
    checkpoint: props.onBoundary,
  });

  return (
    <section ref={stageRef} tabIndex={-1} aria-label="Stage" onKeyDown={onKeyDown} onContextMenu={onContextMenu}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-stage outline-none fullscreen:bg-black">
      {!hasMediaHost && (
        <video controls playsInline preload="none" aria-label={tab?.title ?? "Player"}
          className="size-full bg-stage" style={{ objectFit: objectFitOf(pictureFit) }} />
      )}
      {(render === "embed" || render === "embed-failed") && props.activeSource?.kind === "embed" && (
        <EmbedHost source={props.activeSource.embed} positionMs={props.startPositionMs}
          subtitleLanguage={subtitleLanguage} electron={electron} retry={props.retry}
          onPlayback={embedPlayback} onReady={() => props.onState({ kind: "ready" })} />
      )}
      {(render === "native" || render === "native-failed") && props.activeSource?.kind === "stream" && tab !== undefined && (
        <NativePlayer url={props.activeSource.url} label={tab.title} positionMs={props.startPositionMs}
          autoplay={autoplay} userInitiated={props.userInitiated} retry={props.retry} pictureFit={pictureFit}
          errorReason={props.activeSource.id === "local" ? LOCAL_MEDIA_FAILURE : STREAM_FAILURE}
          onState={props.onState} onProgress={props.onProgress}
          onPlaying={(playing) => { props.onPausedChange(!playing); props.onPlaying(playing); }}
          onSeeked={props.onBoundary} onEnded={props.onBoundary} />
      )}
      {render === "unavailable" && <PlayerStageStatus kind="unavailable" onAction={props.commands.retry} />}
      {render === "no-source" && (
        <PlayerStageStatus kind="no-source" reason={props.noSourceReason} onAction={props.commands.retry} />
      )}
      {(render === "native-failed" || render === "embed-failed") && stage.kind === "failed" && (
        <StageNote reason={stage.reason} onRetry={props.commands.retry} />
      )}
    </section>
  );
}
