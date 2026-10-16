import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const RevisionRow = z.object({ revision: z.number().int() });

/** The backend's one revision counter (docs/03 section 7). */
export function createRevisionRepository(db: DatabaseSync) {
  const read = db.prepare("SELECT revision FROM backend_revision WHERE id = 1");
  const bump = db.prepare("UPDATE backend_revision SET revision = revision + 1 WHERE id = 1");
  return {
    current(): number {
      return RevisionRow.parse(read.get()).revision;
    },
    /** Raises it by one and answers the new value. Callers run this inside the change's transaction. */
    next(): number {
      bump.run();
      return RevisionRow.parse(read.get()).revision;
    },
  };
}

export type RevisionRepository = ReturnType<typeof createRevisionRepository>;
