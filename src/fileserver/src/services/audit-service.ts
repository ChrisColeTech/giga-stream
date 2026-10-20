import type { AuditRepository, AuditWrite } from "../store/audit-repository.js";
import type { Principal } from "../types/account.js";

export interface Actor {
  principal?: Principal;
  address?: string;
}

export function createAuditService(repository: AuditRepository, now: () => number) {
  return {
    record(actor: Actor, entry: Omit<AuditWrite, "actorId" | "actorUsername" | "address">): Promise<void> {
      return repository.append({
        ...entry,
        ...(actor.principal !== undefined && {
          actorId: actor.principal.accountId,
          actorUsername: actor.principal.username,
        }),
        ...(actor.address !== undefined && { address: actor.address }),
      }, now());
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
