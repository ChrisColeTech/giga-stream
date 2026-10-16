import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { isTextField } from "@/lib/text-field";
import type { Surface } from "@/types/shell";

/** Ctrl+1, Ctrl+2, Ctrl+3 switch to Live, Library and Player (`02` section 6). */
const SURFACE_KEYS: Readonly<Record<string, Surface>> = { "1": "live", "2": "library", "3": "player" };

/** Ctrl+0 resets the interface zoom to 100% (`06` section 8; 1 is 100% in the store). */
const ZOOM_RESET = 1;

/** The first candidate that passes `shown`, or undefined. A hidden surface has no boxes, so the one on screen answers. */
export function firstShown<T>(candidates: readonly T[], shown: (node: T) => boolean): T | undefined {
  return candidates.find(shown);
}

/** Focuses the active surface's search: the first `[data-search]` that is laid out. Reports whether it found one. */
function focusActiveSearch(): boolean {
  const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-search]"));
  const field = firstShown(fields, (node) => node.getClientRects().length > 0);
  if (field === undefined) return false;
  field.focus();
  return true;
}

/** The shell's keys (`02` section 6). Escape closes the events drawer when no flow is open; an open work window or popup
 *  owns Escape itself (`useChildWindowKeys`, `usePopupFrame`) and calls `preventDefault`, so one press never cascades
 *  through two layers. A text field owns every key it takes, Escape included, and an IME composition owns all of them.
 *  The shortcuts yield to an open work window as well, except Ctrl+0, which works under one (its zoom row is in Settings). */
export function useShellKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const state = useAppStore.getState();
      const target = event.target instanceof Element ? event.target : null;
      if (target !== null && isTextField(target)) return;

      if (event.key === "Escape") {
        if (state.overlay !== null || !state.eventsOpen) return;
        state.toggleEvents();
        event.preventDefault();
        return;
      }

      if (!event.ctrlKey || event.altKey || event.shiftKey) return;

      /* Ctrl+0 is the one shortcut that works under an open work window: the zoom row lives in Settings (06 section 6.2),
       * so the key that resets it must reach there. Every other shortcut yields to the window. */
      if (event.key === "0") {
        state.setZoom(ZOOM_RESET);
        state.say("Zoom reset to 100%.");
        event.preventDefault();
        return;
      }

      if (state.overlay !== null) return;

      if (event.key === ",") {
        state.openOverlay("settings");
        event.preventDefault();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        if (focusActiveSearch()) event.preventDefault();
        return;
      }

      const surface = SURFACE_KEYS[event.key];
      if (surface === undefined) return;
      state.setSurface(surface);
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
