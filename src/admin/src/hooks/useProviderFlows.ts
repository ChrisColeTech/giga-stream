import { useMemo } from "react";
import { createProviderFlows, type ProviderFlows } from "@/services/provider-flows";
import { providers } from "@/services/providers";
import { useAppStore } from "@/store/app-store";
import { useAuditTail } from "./useAuditTail";

/** The Providers tab's flows (`services/provider-flows.ts`) wired to the real service, the one store and the audit tail. */
export function useProviderFlows(): ProviderFlows {
  const audit = useAuditTail();
  return useMemo(() => createProviderFlows({ service: providers, store: () => useAppStore.getState(), audit }), [audit]);
}
