import type { OverlayId } from "@/types/overlays";

/** The flow ids that are popups, not work windows: they hang off an anchor and cover nothing. */
const POPUPS: ReadonlySet<OverlayId> = new Set<OverlayId>(["account-popup"]);

export const isPopupOverlay = (id: OverlayId | null): boolean => id !== null && POPUPS.has(id);
