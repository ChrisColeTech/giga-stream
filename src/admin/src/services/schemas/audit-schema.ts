import { z } from "zod";
import type { AuditEntry } from "@/types/admin-audit";

/* `GET /api/audit` answers `{ items, nextBefore? }`, newest first (`29` sections 5 and 11). */
export const AuditEntrySchema: z.ZodType<AuditEntry> = z.object({
  id: z.number(),
  at: z.number(),
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  action: z.string(),
  subject: z.string().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  address: z.string().optional(),
});

export const AuditListSchema = z.object({ items: z.array(AuditEntrySchema), nextBefore: z.number().optional() });

export type AuditList = z.infer<typeof AuditListSchema>;
