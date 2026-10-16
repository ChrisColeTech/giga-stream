import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { isTextField } from "@/lib/text-field";
import type { Surface } from "@/types/shell";

/** Ctrl+1, Ctrl+2, Ctrl+3 switch to Live, Library and Player (`02` section 6). */
const SURFACE_KEYS: Readonly<Record<string, Surface>> = { "1": "live", "2": "library", "3": "player" };

/** The shell's keys (`02` section 6). Escape closes the events drawer when no flow is open. An open work window or popup
 *  owns Escape itself (`useChildWindowKeys`, `usePopupFrame`) and calls `preventDefault`, so one press never cascades
 *  through two layers. Global keys yield to text fields, and the surface keys also yield to any open flow. */
export function useShellKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const state = useAppStore.getState();
      const target = event.target instanceof Element ? event.target : null;
      const typing = target !== null && isTextField(target);

      if (event.key === "Escape") {
        if (state.overlay !== null || !state.eventsOpen) return;
        state.toggleEvents();
        event.preventDefault();
        return;
      }

      if (typing || !event.ctrlKey || event.altKey || event.shiftKey) return;

      if (event.key === ",") {
        state.openOverlay("settings");
        event.preventDefault();
        return;
      }

      const surface = SURFACE_KEYS[event.key];
      if (surface === undefined || state.overlay !== null) return;
      state.setSurface(surface);
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
