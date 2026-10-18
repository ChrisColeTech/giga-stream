import { useMemo } from "react";
import { accounts } from "@/services/accounts";
import { createAccountFlows, type AccountFlows } from "@/services/account-flows";
import { useAppStore } from "@/store/app-store";
import { useAuditTail } from "./useAuditTail";

/** The Accounts tab's flows (`services/account-flows.ts`) wired to the real service, the one store and the audit tail. */
export function useAccountFlows(): AccountFlows {
  const audit = useAuditTail();
  return useMemo(() => createAccountFlows({ service: accounts, store: () => useAppStore.getState(), audit }), [audit]);
}
