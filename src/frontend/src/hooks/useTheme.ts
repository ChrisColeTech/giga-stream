import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import type { ThemeMode } from "@/types/shell";

function resolve(theme: ThemeMode): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/* Stamps the theme and accent on <html>, which is what every token override in themes.css selects on. "system" also
 * has to follow the desktop changing its mind mid-session, so the media query is watched for as long as that mode is
 * selected. */
export function useTheme(): void {
  const theme = useAppStore((state) => state.theme);
  const accent = useAppStore((state) => state.accent);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = resolve(theme);
      root.dataset.accent = accent;
    };

    apply();
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, accent]);
}
