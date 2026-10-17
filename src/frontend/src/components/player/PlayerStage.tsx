import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { StageNote } from "@/components/player/StageNote";
import { collectionsSubmenu } from "@/lib/collection-menu";
import { objectFitOf } from "@/lib/live-picture";
import { openMenu } from "@/lib/menu";
import type { PlayerCommands } from "@/lib/player-commands";
import { stageMenuItems } from "@/lib/player-stage-menu";
import type { PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

export interface PlayerStageProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
  /** Reports the video's paused state, so the inspector offers Resume only while nothing plays. */
  readonly onPausedChange: (paused: boolean) => void;
}

/** Whether a key press belongs to a text field or a select, where `F` must type rather than toggle the stage. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

/** The stage (`06` section 5.3): the `<video>` fills the canvas, as Live's does, on the stage's dark surface in every
 *  theme, fitted by the Picture fit preference. There is
 *  no toolbar; Retry, Full screen, Reveal in Library, the item's marks and Close are the picture's context menu, and `F`
 *  toggles full screen. The browser's own controls sit on the dark surface (`styles/video.css`). */
export function PlayerStage({ view, commands, onPausedChange }: PlayerStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  /* The Picture fit preference (Settings > Playback) applies to this stage as it does to Live's. */
  const pictureFit = useAppStore((state) => state.playback.pictureFit);

  /* The stage's own fullscreen events keep the menu's label in step with Escape, which the browser handles. */
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

  const { tab, stage, item, favorite, memberIds, collections } = view;
  const watchId = item?.progress === undefined ? undefined : item.watchId;

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    /* The idle stage has no menu of its own, and never the browser's video menu either. */
    if (tab === undefined) {
      event.preventDefault();
      return;
    }
    openMenu(
      event,
      stageMenuItems({
        fullscreen,
        favorite,
        collections: collectionsSubmenu(collections, (id) => memberIds.includes(id), commands.toggleMember),
        onRemoveHistory: watchId === undefined ? undefined : () => commands.removeHistory(watchId),
        onRetry: commands.retry,
        onFullscreen: toggleFullscreen,
        onReveal: commands.reveal,
        onFavorite: () => commands.favorite(!favorite),
        onClose: commands.close,
      }),
    );
  };

  return (
    <section
      ref={stageRef}
      tabIndex={-1}
      aria-label="Stage"
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-stage outline-none fullscreen:bg-black"
    >
      <video
        controls
        playsInline
        preload="none"
        aria-label={tab?.title ?? "Player"}
        className="size-full bg-stage"
        style={{ objectFit: objectFitOf(pictureFit) }}
        onPlay={() => onPausedChange(false)}
        onPause={() => onPausedChange(true)}
      />
      {stage.kind === "failed" && <StageNote reason={stage.reason} onRetry={commands.retry} />}
    </section>
  );
}
