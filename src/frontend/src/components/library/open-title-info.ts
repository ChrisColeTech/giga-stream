import { useAppStore } from "@/store/app-store";
import type { ItemRef } from "@/types/library";

/** Opens Title information for an item. The opener takes focus first, so the window returns focus to it on close. */
export function openTitleInfo(ref: ItemRef, opener?: HTMLElement | null): void {
  opener?.focus({ preventScroll: true });
  useAppStore.getState().openOverlay("title-info", null, ref);
}
