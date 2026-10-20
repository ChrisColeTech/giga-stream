import { createClient, type Client } from "@libsql/client";
import { z } from "zod";

import { AppError } from "../lib/app-error.js";

export type AdminDatabase = Client;

const REQUIRED_SCHEMA_VERSION = 32;
const VersionRow = z.object({ version: z.coerce.number().int() });
const PragmaRow = z.object({ user_version: z.coerce.number().int() });

/** Opens the fileserver's one authoritative admin-database client. Tests inject this seam. */
export function openAdminDatabase(url: string, authToken: string): AdminDatabase {
  if (url === "") {
    throw new AppError("store.failed", 500, "The admin database is not configured.");
  }
  return createClient({ url, authToken: authToken === "" ? undefined : authToken });
}

/** Refuses any schema other than the backend contract this fileserver was compiled against. */
export async function validateAdminSchema(database: AdminDatabase): Promise<void> {
  let value: number | undefined;
  try {
    const result = await database.execute(
      "SELECT version FROM giga_stream_schema_version WHERE id = 1",
    );
    const row = result.rows[0];
    const version = row === undefined ? undefined : VersionRow.safeParse(row);
    value = version?.success ? version.data.version : undefined;
  } catch (cause) {
    if (database.protocol !== "file") {
      throw new AppError("store.failed", 500, "The admin database schema could not be read.", undefined, cause);
    }
    try {
      value = PragmaRow.parse((await database.execute("PRAGMA user_version")).rows[0]).user_version;
    } catch (fallbackCause) {
      throw new AppError(
        "store.failed", 500, "The admin database schema could not be read.", undefined, fallbackCause,
      );
    }
  }
  if (value !== REQUIRED_SCHEMA_VERSION) {
    throw new AppError(
      "store.failed", 500, `The admin database schema must be version ${REQUIRED_SCHEMA_VERSION}.`,
    );
  }
}
