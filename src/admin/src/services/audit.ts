import { request } from "./api";
import { AuditEntrySchema, AuditPageLenientSchema, type AuditPage } from "./schemas/audit-schema";
import type { AuditEntry } from "@/types/admin-audit";

/** `GET /api/admin/audit?limit=&before=` (`29` section 11), REAL: the Events drawer's history, newest first, paged by `before`
 *  (the entries with an id below it). Entries are read one by one; an unreadable entry is dropped and counted. */
export interface AuditService {
  list: (query?: { readonly limit?: number; readonly before?: number }) => Promise<AuditPage>;
}

function queryOf(query: { readonly limit?: number; readonly before?: number }): string {
  const parts = Object.entries(query)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(([name, value]) => `${name}=${value}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

export const audit: AuditService = {
  list: async (query = {}) => {
    const page = await request(`/api/admin/audit${queryOf(query)}`, AuditPageLenientSchema);
    const items: AuditEntry[] = [];
    for (const raw of page.items) {
      const parsed = AuditEntrySchema.safeParse(raw);
      if (parsed.success) items.push(parsed.data);
    }
    return {
      items,
      unreadable: page.items.length - items.length,
      ...(page.nextBefore !== undefined && { nextBefore: page.nextBefore }),
    };
  },
};
