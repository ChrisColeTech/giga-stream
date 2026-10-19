import { useCallback } from "react";
import { useAppStore } from "@/store/app-store";

/** The providers' `Preview` verbs (`55` decision 7): the row's eye and the workspace's `Preview →` both open the same
 *  window through this one entry. The slice takes the request value (the provider and a raised serial), then the one
 *  open flow becomes `provider-preview`, replacing whatever flow was open. */
export function useProviderPreviewOpen(): (providerId: number) => void {
  return useCallback((providerId: number) => {
    const state = useAppStore.getState();
    state.providersOpenPreview(providerId);
    state.openOverlay("provider-preview");
  }, []);
}