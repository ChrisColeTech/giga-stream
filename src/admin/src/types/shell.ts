import type { PaneSide } from "@giga/ui/panes/pane-types";

/** The six tabs of the admin (`26` section 4.4). The pill is the only navigation; there is no router. */
export type Tab = "channels" | "providers" | "titles" | "playlists" | "jobs" | "accounts";

export type { PaneSide };

/** A pane's identity in the store and the tween engine: the tab and the side it sits on. The admin has a left pane only
 *  (a workspace's rail), so every key ends in `.left`. */
export type PaneKey = `${Tab}.${PaneSide}`;
