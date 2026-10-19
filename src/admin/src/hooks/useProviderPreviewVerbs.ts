import { useState } from "react";
import type { ToggleVerb } from "@/lib/preview-verbs";
import { draftOfProvider } from "@/lib/provider-draft";
import { PROVIDER_GONE, SAVING_REASON, UNREACHABLE_REASON } from "@/constants/provider-copy";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { useProviderFlows } from "./useProviderFlows";

export interface ProviderPreviewVerbs {
  /** The toolbar's `Enabled` switch plan. */
  readonly enabled: ToggleVerb;
  readonly toggleEnabled: () => void;
}

/** The provider preview's `Enabled` switch (`55` decision 7, the channels' own labelled pattern): the provider's own
 *  `is_active` through the Providers flows' ONE save - a `PUT` of the single changed field. One verb runs at a time; the
 *  answer replaces the row and the window together. */
export function useProviderPreviewVerbs(
  provider: AdminProvider | undefined,
  unreachable: boolean,
): ProviderPreviewVerbs {
  const flows = useProviderFlows();
  const [busy, setBusy] = useState(false);

  const toggle = (): void => {
    if (provider === undefined || busy) return;
    setBusy(true);
    void flows
      .save(provider.id, { ...draftOfProvider(provider), enabled: !provider.is_active })
      .finally(() => setBusy(false));
  };

  return {
    enabled: {
      checked: provider?.is_active !== false,
      reason:
        provider === undefined
          ? PROVIDER_GONE
          : unreachable
            ? UNREACHABLE_REASON
            : busy
              ? SAVING_REASON
              : undefined,
    },
    toggleEnabled: toggle,
  };
}