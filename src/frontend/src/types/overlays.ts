/** Every work window the one overlay host can open (`OverlayHost`). Opening one replaces the open one. */
export type OverlayId = "settings" | "collections" | "title-info" | "account";

/* Auth no longer owns an authored popup, but the interface's generic popup scaffold keeps its shared type path. */
export type { PopupPanelProps } from "@giga/ui/lib/popup-types";
