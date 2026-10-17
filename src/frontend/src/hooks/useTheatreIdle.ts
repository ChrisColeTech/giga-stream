import { useEffect } from "react";
import {
  THEATRE_ACTIVITY_EVENTS,
  THEATRE_BLOCKING_SELECTOR,
  THEATRE_FIELD_SELECTOR,
  THEATRE_IDLE_MS,
  THEATRE_MOVE_EVENT,
} from "@/constants/theatre-idle";
import { createIdleController } from "@/lib/theatre-idle";
import { useAppStore } from "@/store/app-store";

/** True while something forbids hiding the bars: a menu or dialog is in the document, or a text field has focus. */
function blockedByPage(): boolean {
  if (document.querySelector(THEATRE_BLOCKING_SELECTOR) !== null) return true;
  const focused = document.activeElement;
  return focused instanceof Element && focused.matches(THEATRE_FIELD_SELECTOR);
}

/** While Theatre is on, fades the title and status bar contents out after `THEATRE_IDLE_MS` without mouse or
 *  keyboard activity, and brings them back on the next input. The timer and the window listeners live here, in the
 *  capture phase so nothing in the page can swallow the input; the store only holds the result (`chromeIdle`).
 *  A work window or overlay open (the store) blocks the hiding and wakes the bars; a menu or a focused text field
 *  does the same at the moment the timer would fire. Known limit: a provider's embedded player is a cross-origin
 *  iframe, so input inside it never reaches this page; it does not keep the bars awake, and moving the mouse back
 *  onto the bars (outside the stage) wakes them. Mounted after `useTheme`, before `useNativeOverlay`. */
export function useTheatreIdle(): void {
  const theatre = useAppStore((state) => state.theatre);
  const overlayOpen = useAppStore((state) => state.overlay !== null);
  const enabled = theatre && !overlayOpen;

  useEffect(() => {
    if (!enabled) return undefined;
    const setChromeIdle = useAppStore.getState().setChromeIdle;
    const controller = createIdleController({
      idleMs: THEATRE_IDLE_MS,
      schedule: (task, delay) => window.setTimeout(task, delay),
      cancel: (id) => window.clearTimeout(id),
      onIdle: () => setChromeIdle(true),
      onActive: () => setChromeIdle(false),
      canIdle: () => !blockedByPage(),
    });
    const onInput = (event: Event): void => {
      if (event.type === THEATRE_MOVE_EVENT && event instanceof MouseEvent) {
        controller.activity({ x: event.clientX, y: event.clientY });
      } else {
        controller.activity();
      }
    };
    const options = { capture: true, passive: true } as const;
    for (const name of THEATRE_ACTIVITY_EVENTS) window.addEventListener(name, onInput, options);
    controller.arm();
    return () => {
      for (const name of THEATRE_ACTIVITY_EVENTS) window.removeEventListener(name, onInput, options);
      controller.stop();
    };
  }, [enabled]);
}
