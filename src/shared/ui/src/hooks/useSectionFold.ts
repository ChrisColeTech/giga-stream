import { animate, type AnimationPlaybackControls } from "framer-motion";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { DUR_COLLAPSE_MS, EASE_P2P } from "../lib/motion-timing";
import { useReduceMotion } from "./useReduceMotion";

/** The tween a section's fold and its chevron share. */
export const FOLD_TWEEN = { duration: DUR_COLLAPSE_MS / 1000, ease: EASE_P2P } as const;

/* THE FOLD. Animating the layout's own value (`flex-grow`, 1 open and 0 closed) does not move: grow is a RATIO of the free
 * space, so the section teleports at the last instant. So the section that moves leaves the flex sizing for the length of
 * the tween (`flex: 0 0 <px>`) and its basis is animated between the two heights flex would choose; every other section
 * keeps its resting `flex: 1 1 auto` and yields the space continuously. The target is MEASURED after React commits (the DOM
 * is already at rest in the new state), never guessed. This is real layout every frame, not a transform, so no text is
 * scaled mid-flight, which is why it is not Framer's `layout` prop. It is imperative on purpose: display, overflow and the
 * three geometry properties must change together, before paint. */
export function useSectionFold(
  ref: RefObject<HTMLElement | null>,
  bodyRef: RefObject<HTMLDivElement | null>,
  open: boolean,
  pressedAt: RefObject<number | null>,
): void {
  const running = useRef<AnimationPlaybackControls | null>(null);
  const reduce = useReduceMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    const body = bodyRef.current;
    if (el === null || body === null) return;

    /* The resting geometry of the state we are now in. It is also what undoes the animation's overrides at the end. */
    const rest = () => {
      el.style.flexGrow = open ? "1" : "0";
      el.style.flexShrink = open ? "1" : "0";
      el.style.flexBasis = "auto";
      el.style.height = "";
      body.style.display = open ? "flex" : "none";
      body.style.overflow = "";
    };

    running.current?.stop();
    running.current = null;

    /* `from` is the height at the instant of the press. Null means the open state moved without a press (a restored
       preference), which must paint, not play. The app's Reduce motion setting paints too. */
    const from = pressedAt.current;
    pressedAt.current = null;
    rest();
    if (from === null || reduce) return;

    const to = el.getBoundingClientRect().height;
    /* Nothing to travel: pressed twice inside one frame, or the content is already the height of its header. */
    if (Math.abs(to - from) < 1) return;

    /* Out of the flex sizing, back where it was, and the body kept on screen: `display: none` at the start of a collapse
       would empty the section on frame one. `overflow: hidden` so a body briefly taller than its box does not flash a
       scrollbar on every collapse (owner, 2026-08-06). */
    el.style.flexGrow = "0";
    el.style.flexShrink = "0";
    el.style.flexBasis = `${from}px`;
    body.style.display = "flex";
    body.style.overflow = "hidden";

    running.current = animate(from, to, {
      ...FOLD_TWEEN,
      onUpdate: (height) => {
        el.style.flexBasis = `${height}px`;
      },
      onComplete: rest,
    });
  }, [open, reduce]);

  /* Stopping on unmount matters: the callbacks write to a detached element, and a hot reload remounts mid-flight. */
  useLayoutEffect(() => () => running.current?.stop(), []);
}
