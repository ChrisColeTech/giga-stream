import { useEffect } from "react";
import { TITLEBAR_HEIGHT } from "@giga/ui/lib/child-metrics";
import { hostAvailable, setOverlay } from "@/services/admin-host";
import { useAppStore } from "@/store/app-store";

/** The native caption strip (Windows' title bar overlay) is painted by the OS, so the page must tell it what to wear: the
 *  bar's `--color-panel`, the symbols' `--color-faint`, read back from the document so a retheme needs no second palette,
 *  and a height that tracks the UI zoom the page applies itself. The strip ends one border above the bar's bottom edge,
 *  so the native buttons never paint over the titlebar's hairline at any zoom. It runs after `useTheme` in the same
 *  component, so the attributes it reads are already stamped; in a browser there is no host and it does nothing. */
export function useCaptionOverlay(): void {
  const theme = useAppStore((state) => state.theme);
  const accent = useAppStore((state) => state.accent);
  const uiZoom = useAppStore((state) => state.uiZoom);
  const signedIn = useAppStore((state) => state.signedIn);

  useEffect(() => {
    if (!hostAvailable()) return undefined;
    const push = (): void => {
      const style = getComputedStyle(document.documentElement);
      void setOverlay({
        /* Signed out there is no bar: the gate's right column (`--color-surface`) runs to the top edge under the strip. */
        color: style.getPropertyValue(signedIn ? "--color-panel" : "--color-surface").trim(),
        symbolColor: style.getPropertyValue("--color-faint").trim(),
        height: Math.round((signedIn ? TITLEBAR_HEIGHT - 1 : TITLEBAR_HEIGHT) * uiZoom),
      });
    };
    push();
    /* A "system" theme also has to follow the desktop changing its mind mid-session, as the theme stamp does. */
    const watched = theme === "system" ? window.matchMedia("(prefers-color-scheme: light)") : null;
    watched?.addEventListener("change", push);
    return () => watched?.removeEventListener("change", push);
  }, [theme, accent, uiZoom, signedIn]);
}
