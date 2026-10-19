/** The three persistent surfaces (`03` section 1). Switching never remounts the shell. */
export type Surface = "live" | "library" | "player";

export type PaneSide = "left" | "right" | "bottom";

/** A pane's identity in the store and the tween engine: the surface and the side it sits on. */
export type PaneKey = `${Surface}.${PaneSide}`;

export type ThemeMode = "dark" | "light";

export type Accent = "amber" | "violet" | "blue" | "green" | "rose";

/** "off" always animates (the default), "on" never does. */
export type MotionPreference = "off" | "on";
