/** Every flow the one overlay host can open (`OverlayHost`). Opening a flow replaces the open one. A work surface is a
 *  modal child window drawn inside the main window; a popup hangs off an anchor and covers nothing. */
export type OverlayId = "settings" | "collections" | "title-info";

/* The popup types live in the family UI library (docs/27 step 7); this is the interface's path to them. */
export type {
  PopupAnchor,
  PopupPanelProps,
  PopupPolicy,
  PopupProps,
  PopupSize,
} from "@giga/ui/lib/popup-types";
