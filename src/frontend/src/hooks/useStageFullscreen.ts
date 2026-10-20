import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

export interface StageFullscreen {
  readonly ref: RefObject<HTMLElement | null>;
  readonly fullscreen: boolean;
  readonly toggle: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/** Owns the stage's Fullscreen API state and listener. */
export function useStageFullscreen(): StageFullscreen {
  const ref = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const sync = (): void => setFullscreen(document.fullscreenElement === node);
    node.addEventListener("fullscreenchange", sync);
    return () => node.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = (): void => {
    const node = ref.current;
    if (node === null) return;
    if (document.fullscreenElement === node) void document.exitFullscreen().catch(() => undefined);
    else void node.requestFullscreen().catch(() => undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if ((event.key !== "f" && event.key !== "F") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    toggle();
  };
  return { ref, fullscreen, toggle, onKeyDown };
}
