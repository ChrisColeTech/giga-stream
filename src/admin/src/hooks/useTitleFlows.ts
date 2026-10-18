import { useMemo } from "react";
import { createTitleFlows, type TitleFlows } from "@/services/title-flows";
import { titles } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { useAuditTail } from "./useAuditTail";

/** The Titles tab's flows (`services/title-flows.ts`) wired to the real service, the one store and the audit tail. */
export function useTitleFlows(): TitleFlows {
  const audit = useAuditTail();
  return useMemo(() => createTitleFlows({ service: titles, store: () => useAppStore.getState(), audit }), [audit]);
}
