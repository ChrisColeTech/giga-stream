import type { AdminDatabase } from "./admin-database.js";

export interface AuditWrite {
  actorId?: string;
  actorUsername?: string;
  action: string;
  subject?: string;
  detail?: Record<string, unknown>;
  address?: string;
}

/** Append-only audit writes over the migration-032 audit_log contract (docs/03 section 7.13). */
export function createAuditRepository(database: AdminDatabase) {
  return {
    async append(entry: AuditWrite, at: number): Promise<void> {
      await database.execute({
        sql: `INSERT INTO audit_log
          (at, actor_id, actor_username, action, subject, detail, address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          at, entry.actorId ?? null, entry.actorUsername ?? null, entry.action,
          entry.subject ?? null, entry.detail === undefined ? null : JSON.stringify(entry.detail),
          entry.address ?? null,
        ],
      });
    },
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
