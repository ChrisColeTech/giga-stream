import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ResumeBanner } from "@/components/player/ResumeBanner";
import { StageNote } from "@/components/player/StageNote";
import { StageToolbar } from "@/components/player/StageToolbar";
import type { PlayerCommands } from "@/lib/player-commands";
import { resumeOf, stageSubtitle, type PlayerView } from "@/lib/player-view";

export interface PlayerStageProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
}

/** Whether a key press belongs to a text field or a select, where `F` must type rather than toggle the stage. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

/** The stage (`06` section 5.3): a toolbar over the `<video>`, which fills the stage with the picture fitted whole inside
 *  a 16 px pad and the browser's own controls. The stage element is the fullscreen element. With no tab open, the stage
 *  is the player alone. */
export function PlayerStage({ view, commands }: PlayerStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  /* The stage's own fullscreen events keep the button in step with Escape, which the browser handles. */
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
    if (document.fullscreenElement === node) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void node.requestFullscreen().catch(() => undefined);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key !== "f" && event.key !== "F") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    toggleFullscreen();
  };

  const { tab, stage } = view;
  const resume = resumeOf(view);

  return (
    <section
      ref={stageRef}
      tabIndex={-1}
      aria-label="Stage"
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg outline-none fullscreen:bg-black"
    >
      {tab !== undefined && (
        <StageToolbar
          kind={tab.kind}
          title={tab.title}
          subtitle={stageSubtitle(view)}
          fullscreen={fullscreen}
          onFullscreen={toggleFullscreen}
          onRetry={commands.retry}
          onReveal={commands.reveal}
          onClose={commands.close}
        />
      )}
      {tab !== undefined && resume !== undefined && (
        <ResumeBanner progress={resume} onResume={commands.resume} onStartOver={commands.startOver} />
      )}
      <div className="relative min-h-0 flex-1">
        <video controls playsInline preload="none" aria-label={tab?.title ?? "Player"} className="size-full bg-bg object-contain" />
        {stage.kind === "failed" && <StageNote reason={stage.reason} onRetry={commands.retry} />}
      </div>
    </section>
  );
}
