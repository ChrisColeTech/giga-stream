import { z } from "zod";

import type { Database } from "./database.js";

const RevisionRow = z.object({ revision: z.number().int() });

const READ_SQL = "SELECT revision FROM backend_revision WHERE id = 1";
const BUMP_SQL = "UPDATE backend_revision SET revision = revision + 1 WHERE id = 1";

/** The backend's one revision counter (docs/03 section 7). */
export function createRevisionRepository(db: Database) {
  const read = async (): Promise<number> => RevisionRow.parse((await db.execute(READ_SQL)).rows[0]).revision;
  return {
    current: (): Promise<number> => read(),
    /** Raises it by one and answers the new value. Callers run this inside the change's transaction. */
    next: async (): Promise<number> => {
      await db.execute(BUMP_SQL);
      return read();
    },
  };
}

export type RevisionRepository = ReturnType<typeof createRevisionRepository>;
