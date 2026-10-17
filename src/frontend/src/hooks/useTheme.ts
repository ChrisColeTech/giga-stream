import { useEffect } from "react";
import { REDUCED_MOTION_QUERY } from "@giga/ui/lib/motion-timing";
import { resolveReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { useAppStore } from "@/store/app-store";
import type { ThemeMode } from "@/types/shell";

function resolve(theme: ThemeMode): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/* Stamps the theme, the accent, the resolved motion and Theatre mode on <html>, which is what every token override
 * and the motion kill-switch (styles/motion-reduce.css) select on. A "system" choice also has to follow the desktop
 * changing its mind mid-session, so its media query is watched for as long as that mode is selected. The app's Reduce
 * motion therefore wins over the desktop's: Off keeps motion even when the desktop asks for less. Theatre's black is
 * a root token remap too (index.css), so its attribute rides here with the others: one hook stamps every root
 * attribute, in order, before anything downstream reads the tokens (the native overlay's palette does). The idle
 * attribute (`data-chrome-idle`, only while Theatre is on and the bars have faded, see useTheatreIdle) rides here too. */
export function useTheme(): void {
  const theme = useAppStore((state) => state.theme);
  const accent = useAppStore((state) => state.accent);
  const motion = useAppStore((state) => state.motion);
  const theatre = useAppStore((state) => state.theatre);
  const chromeIdle = useAppStore((state) => state.chromeIdle);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = resolve(theme);
      root.dataset.accent = accent;
      root.dataset.motion = resolveReduceMotion(motion) ? "reduce" : "full";
      if (theatre) root.dataset.theatre = "";
      else delete root.dataset.theatre;
      if (theatre && chromeIdle) root.dataset.chromeIdle = "";
      else delete root.dataset.chromeIdle;
    };

    apply();
    const watched = [
      theme === "system" ? window.matchMedia("(prefers-color-scheme: light)") : null,
      motion === "system" ? window.matchMedia(REDUCED_MOTION_QUERY) : null,
    ].filter((query): query is MediaQueryList => query !== null);
    for (const query of watched) query.addEventListener("change", apply);
    return () => {
      for (const query of watched) query.removeEventListener("change", apply);
    };
  }, [theme, accent, motion, theatre, chromeIdle]);
}
