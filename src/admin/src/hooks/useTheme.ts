import { useEffect } from "react";
import { REDUCED_MOTION_QUERY } from "@giga/ui/lib/motion-timing";
import { resolveReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { useAppStore } from "@/store/app-store";
import type { ThemeMode } from "@/types/shell";

function resolve(theme: ThemeMode): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/* Stamps the theme, the accent and the resolved motion on <html>, which is what every token override and the motion
 * kill-switch (styles/motion-reduce.css) select on. A "system" choice also has to follow the desktop changing its mind
 * mid-session, so its media query is watched for as long as that mode is selected. The app's Reduce motion therefore
 * wins over the desktop's: Off keeps motion even when the desktop asks for less. */
export function useTheme(): void {
  const theme = useAppStore((state) => state.theme);
  const accent = useAppStore((state) => state.accent);
  const motion = useAppStore((state) => state.motion);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = resolve(theme);
      root.dataset.accent = accent;
      root.dataset.motion = resolveReduceMotion(motion) ? "reduce" : "full";
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
  }, [theme, accent, motion]);
}
