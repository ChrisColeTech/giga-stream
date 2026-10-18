/** One row of the backend's audit log, as `GET /api/audit` answers it (`29` section 5): newest first on the wire. The
 *  Events drawer turns it into a sentence (`lib/event-sentence.ts`); nothing here is ever drawn directly. */
export interface AuditEntry {
  readonly id: number;
  /** Unix milliseconds. */
  readonly at: number;
  readonly actorId?: string;
  readonly actorUsername?: string;
  /** Dotted and stable: `auth.login`, `channel.created`, `job.updated`. */
  readonly action: string;
  /** The id of the record the action was about. */
  readonly subject?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly address?: string;
}
