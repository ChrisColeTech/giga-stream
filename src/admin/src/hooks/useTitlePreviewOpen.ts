import { useCallback } from "react";
import { useAppStore } from "@/store/app-store";

/** The titles' `Preview` verbs (`55` decision 8): the row's eye and the workspace's `Preview →` both open the same
 *  window through this one entry. The slice takes the request value (the title and a raised serial), then the one open
 *  flow becomes `title-preview`, replacing whatever flow was open. */
export function useTitlePreviewOpen(): (titleId: string) => void {
  return useCallback((titleId: string) => {
    const state = useAppStore.getState();
    state.titlesOpenPreview(titleId);
    state.openOverlay("title-preview");
  }, []);
}