/** The backend's account as `GET /api/admin/accounts` answers it (`29` section 5; never a hash). The schema is the one
 *  source of the shape; this is the name the rest of the app imports. */
export type { AdminAccount } from "@/services/schemas/account-schema";

/** An account's id as the backend gives it (a string today; the schema also accepts a number). */
export type AccountId = string | number;
