import { z } from "zod";
import type { AuditEntry } from "@/types/admin-audit";

/* `GET /api/audit` answers `{ items, nextBefore? }`, newest first (`29` sections 5 and 11). */
export const AuditEntrySchema: z.ZodType<AuditEntry> = z.object({
  id: z.number(),
  at: z.number(),
  actorId: z.string().optional(),
  actorUsername: z.string().optional(),
  action: z.string(),
  subject: z.string().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  address: z.string().optional(),
});

/** The page as the service reads it: entries stay `unknown` so one unreadable entry costs that entry, not the page. */
export const AuditPageLenientSchema = z.object({ items: z.array(z.unknown()), nextBefore: z.number().optional() });

/** The readable entries of a page (newest first), the cursor for the page before them, and how many entries could not
 *  be read. */
export interface AuditPage {
  readonly items: AuditEntry[];
  readonly nextBefore?: number;
  readonly unreadable: number;
}
