import { useEffect } from "react";
import { TITLEBAR_HEIGHT } from "@/constants/child-window";
import { useAppStore } from "@/store/app-store";

/** The overlay palette read back from the tokens themselves, so a retheme or Theatre's remap needs no second
 *  palette here: the strip wears the panel tone with the faint text tone on it, whatever the theme says. */
function palette(): { color: string; symbolColor: string } {
  const style = getComputedStyle(document.documentElement);
  return {
    color: style.getPropertyValue("--color-panel").trim(),
    symbolColor: style.getPropertyValue("--color-faint").trim(),
  };
}

/** The native caption strip (Windows' titleBarOverlay) is painted by the OS, so the page must tell it what to
 *  wear: the theme's panel and text tones - Theatre's black remap included, since this reads the same tokens -
 *  and a height that tracks the UI zoom the page applies itself. The strip ends one border above the bar's
 *  bottom edge (`TITLEBAR_HEIGHT - 1`), so the native buttons never paint over the titlebar's own hairline at
 *  any zoom. This hook runs after `useTheme` in the same component, so the attribute stamps it reads are always
 *  applied; in a browser there is no pocHost and this is a no-op. */
export function useNativeOverlay(): void {
  const theme = useAppStore((state) => state.theme);
  const theatre = useAppStore((state) => state.theatre);
  const uiZoom = useAppStore((state) => state.uiZoom);

  useEffect(() => {
    const host = typeof window === "undefined" ? undefined : window.pocHost;
    if (host?.runtime !== "electron" || typeof host.setOverlay !== "function") return undefined;

    const push = (): void => {
      const { color, symbolColor } = palette();
      void host.setOverlay({ color, symbolColor, height: Math.round((TITLEBAR_HEIGHT - 1) * uiZoom) });
    };

    push();
    /* A "system" theme also has to follow the desktop changing its mind mid-session, as the theme stamp does. */
    const watched = theme === "system" ? window.matchMedia("(prefers-color-scheme: light)") : null;
    watched?.addEventListener("change", push);
    return () => watched?.removeEventListener("change", push);
  }, [theme, theatre, uiZoom]);
}
