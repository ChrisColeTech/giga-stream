import { useEffect } from "react";
import { REDUCED_MOTION_QUERY } from "../lib/motion-timing";
import { resolveReduceMotion, type MotionPreference } from "./useReduceMotion";
import type { ThemeChoice } from "../store/chrome-types";

export interface ThemeValues {
  readonly theme: ThemeChoice;
  readonly accent: string;
  readonly motion: MotionPreference;
  /** Theatre mode's black chrome; absent for a program without it. */
  readonly theatre?: boolean;
  /** Theatre's bars have faded (`data-chrome-idle`); only meaningful while `theatre` is set. */
  readonly chromeIdle?: boolean;
}

function resolve(theme: ThemeChoice): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/* Stamps the theme, the accent, the resolved motion and the Theatre attributes on <html>, which is what every token
 * override and the motion kill-switch (styles/motion-reduce.css) select on. A "system" choice follows the OS while
 * it is selected, and "system" motion follows the OS's reduce-motion query. The program passes its values; the hook
 * reads no store, so any program stamps the same attributes the same way. */
export function useTheme(values: ThemeValues): void {
  const { theme, accent, motion } = values;
  const theatre = values.theatre === true;
  const chromeIdle = values.chromeIdle === true;

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
