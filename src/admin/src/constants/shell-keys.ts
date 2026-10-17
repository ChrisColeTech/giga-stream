import type { ShellKeyMap } from "@giga/ui/hooks/useShellKeys";
import type { Tab } from "@/types/shell";
import { TAB_ORDER } from "./tabs";

/** What a shell key does, by id: show a tab, open Settings, find the Titles search, reset the zoom, close the drawer. */
export type ShellAction = Tab | "settings" | "search" | "zoom-reset" | "close-events";

const TAB_KEYS: Readonly<Record<string, ShellAction>> = Object.fromEntries(
  TAB_ORDER.map((tab, index) => [String(index + 1), tab]),
);

/** The admin's shell keys (`28` Appendix A, row 56): `Ctrl+1`..`Ctrl+6` pick the tabs, `Ctrl+,` opens Settings, `Ctrl+F`
 *  focuses the on-screen `[data-search]` (the Titles search), `Ctrl+0` resets the zoom even under a window, and Escape
 *  closes the events drawer when no window is open. A text field and an IME composition keep their keys. */
export const SHELL_KEYS: ShellKeyMap<ShellAction> = {
  ctrl: { ...TAB_KEYS, ",": "settings", f: "search" },
  ctrlAlways: { "0": "zoom-reset" },
  escape: "close-events",
};
