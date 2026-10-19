import { useEffect } from "react";
import { TITLEBAR_HEIGHT } from "@/constants/child-window";
import { overlayColors, type OverlayColors } from "@/lib/overlay-colors";
import { useAppStore } from "@/store/app-store";

/** The overlay palette read back from the tokens themselves, so a retheme or Theatre's remap needs no second
 *  palette here: the strip wears the panel tone with the faint text tone on it, whatever the theme says. */
function palette(idle: boolean): OverlayColors {
  const style = getComputedStyle(document.documentElement);
  return overlayColors(
    { panel: style.getPropertyValue("--color-panel").trim(), faint: style.getPropertyValue("--color-faint").trim() },
    idle,
  );
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
  const chromeIdle = useAppStore((state) => state.chromeIdle);

  useEffect(() => {
    const host = typeof window === "undefined" ? undefined : window.pocHost;
    if (host?.runtime !== "electron" || typeof host.setOverlay !== "function") return undefined;

    const push = (): void => {
      /* While the bars are idle the caption symbols wear the strip's own colour, which hides what CSS cannot reach. */
      const { color, symbolColor } = palette(chromeIdle);
      void host.setOverlay({ color, symbolColor, height: Math.round((TITLEBAR_HEIGHT - 1) * uiZoom) });
    };

    push();
    return undefined;
  }, [theme, theatre, uiZoom, chromeIdle]);
}
