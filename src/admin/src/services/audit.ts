import { notConnected } from "./not-connected";
import type { AuditList } from "./schemas/audit-schema";

/** `GET /api/audit` (`29` section 11): the Events drawer's history, newest first, paged by `before`. NOT CONNECTED: refuses
 *  until the audit is wired; the drawer then shows the refusal as a row and keeps `Load older` disabled. */
export interface AuditService {
  list: (query?: { readonly before?: number }) => Promise<AuditList>;
}

export const audit: AuditService = {
  list: () => notConnected("audit.list"),
};
