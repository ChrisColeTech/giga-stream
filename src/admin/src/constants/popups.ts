import type { OverlayId } from "@/types/overlays";

/** The flow ids that are popups, not work windows: they hang off an anchor and cover nothing. Empty until a popup is
 *  decided (`21` section 8): Title information is a work window, and no other popup has been asked for. The popup
 *  size classes and placement are the family UI library's (`@giga/ui/lib/popup-metrics`). */
const POPUPS: ReadonlySet<OverlayId> = new Set<OverlayId>([]);

export const isPopupOverlay = (id: OverlayId | null): boolean => id !== null && POPUPS.has(id);
