import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const EntryRow = z.object({
  id: z.number().int(),
  at: z.number().int(),
  actor_id: z.string().nullable(),
  actor_username: z.string().nullable(),
  action: z.string(),
  subject: z.string().nullable(),
  detail: z.string().nullable(),
  address: z.string().nullable(),
});

/** An audit entry as the backend answers it (docs/03 section 7.13). */
export interface AuditEntry {
  id: number;
  at: number;
  actorId?: string;
  actorUsername?: string;
  action: string;
  subject?: string;
  detail?: Record<string, unknown>;
  address?: string;
}

export interface AuditWrite {
  actorId?: string;
  actorUsername?: string;
  action: string;
  subject?: string;
  detail?: Record<string, unknown>;
  address?: string;
}

function toEntry(row: unknown): AuditEntry {
  const r = EntryRow.parse(row);
  const detail: unknown = r.detail === null ? undefined : JSON.parse(r.detail);
  return {
    id: r.id,
    at: r.at,
    ...(r.actor_id !== null && { actorId: r.actor_id }),
    ...(r.actor_username !== null && { actorUsername: r.actor_username }),
    action: r.action,
    ...(r.subject !== null && { subject: r.subject }),
    ...(typeof detail === "object" && detail !== null && { detail: detail as Record<string, unknown> }),
    ...(r.address !== null && { address: r.address }),
  };
}

/** The audit log: append and page newest first. */
export function createAuditRepository(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT INTO audit_log (at, actor_id, actor_username, action, subject, detail, address) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const page = db.prepare(`SELECT id, at, actor_id, actor_username, action, subject, detail, address FROM audit_log
    WHERE id < ? ORDER BY id DESC LIMIT ?`);

  return {
    append(entry: AuditWrite, at: number): void {
      insert.run(
        at,
        entry.actorId ?? null,
        entry.actorUsername ?? null,
        entry.action,
        entry.subject ?? null,
        entry.detail === undefined ? null : JSON.stringify(entry.detail),
        entry.address ?? null,
      );
    },
    /** Up to `limit` entries older than `before` (an entry id), newest first. */
    page(before: number, limit: number): AuditEntry[] {
      return page.all(before, limit).map(toEntry);
    },
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
