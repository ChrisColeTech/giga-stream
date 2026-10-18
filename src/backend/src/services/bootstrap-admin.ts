import { AccountCreateSchema } from "../types/account.js";
import type { AccountService } from "./account-service.js";

/** What happened at start: the first admin was created, accounts already existed, or nobody can sign in. */
export type BootstrapOutcome = "created" | "existing" | "none";

/**
 * The first admin (docs/03 section 7.11): with no accounts and both bootstrap variables set, create that
 * account. A bootstrap username or password that is not valid stops the start, naming why.
 */
export async function bootstrapAdmin(
  accounts: AccountService,
  hasAccounts: boolean,
  username: string,
  password: string,
): Promise<BootstrapOutcome> {
  if (hasAccounts) return "existing";
  if (username === "" || password === "") return "none";
  const input = AccountCreateSchema.safeParse({ username, name: "Admin", password });
  if (!input.success) {
    const field = input.error.issues[0]?.path.join(".") ?? "username";
    const name = field === "password" ? "PASSWORD" : "USERNAME";
    throw new Error(`ADMIN_BOOTSTRAP_${name} is not valid: ${input.error.issues[0]?.message}`);
  }
  await accounts.create(input.data, { address: "bootstrap" });
  return "created";
}
