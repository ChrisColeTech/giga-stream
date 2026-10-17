import { useTheme as useThemeStamp } from "@giga/ui/hooks/useTheme";
import { useAppStore } from "@/store/app-store";

/* The interface's root stamp: the store's theme, accent, motion and Theatre values go to the shared hook, which stamps
 * them on <html>. Theatre's black is a root token remap too (index.css), so its attributes ride with the others: one
 * hook stamps every root attribute, in order, before anything downstream reads the tokens (the native overlay's
 * palette does). The idle attribute (`data-chrome-idle`, only while Theatre is on and the bars have faded, see
 * useTheatreIdle) rides here too. */
export function useTheme(): void {
  const theme = useAppStore((state) => state.theme);
  const accent = useAppStore((state) => state.accent);
  const motion = useAppStore((state) => state.motion);
  const theatre = useAppStore((state) => state.theatre);
  const chromeIdle = useAppStore((state) => state.chromeIdle);
  useThemeStamp({ theme, accent, motion, theatre, chromeIdle });
}
