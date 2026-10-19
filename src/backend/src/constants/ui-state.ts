import type { AdminSettings, AdminShell } from "../types/ui-state.js";

/** The admin's tabs, in the order of its tab pill (docs/26 section 4.2). */
export const ADMIN_TABS = ["channels", "providers", "titles", "playlists", "jobs", "accounts"] as const;

/** What an account reads before it has saved anything: the sign-in page's own look (docs/29 section 6.1). */
export const DEFAULT_SETTINGS: AdminSettings = {
  theme: "dark",
  themeAccent: "amber",
  reducedMotion: "off",
  uiZoom: 1,
};
export const DEFAULT_SHELL: AdminShell = { tab: "channels", panes: {}, eventsOpen: false, windows: {} };

/** A workspace rail's saved width, in pixels; the admin clamps it again to the tab's own limits when it applies it. */
export const PANE_WIDTH_MIN = 120;
export const PANE_WIDTH_MAX = 800;

/** A work window's x, y, width and height are whole numbers from 0 to this (width and height from 1). */
export const WINDOW_COORDINATE_MAX = 20_000;

/** The interface zoom: tenths from one half to three times. */
export const UI_ZOOM_MIN = 0.5;
export const UI_ZOOM_MAX = 3;
