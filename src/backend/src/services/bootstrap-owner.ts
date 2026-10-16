import { AccountCreateSchema } from "../types/account.js";
import type { AccountService } from "./account-service.js";

/** What happened at start: an owner was created, accounts already existed, or nobody can sign in. */
export type BootstrapOutcome = "created" | "existing" | "none";

/**
 * The first owner (docs/03 section 7.11): with no accounts and both bootstrap variables set, create that
 * owner. A bootstrap email or password that is not valid stops the start, naming why.
 */
export async function bootstrapOwner(
  accounts: AccountService,
  hasAccounts: boolean,
  email: string,
  password: string,
): Promise<BootstrapOutcome> {
  if (hasAccounts) return "existing";
  if (email === "" || password === "") return "none";
  const input = AccountCreateSchema.safeParse({ email, name: "Owner", role: "owner", password });
  if (!input.success) {
    const field = input.error.issues[0]?.path.join(".") ?? "email";
    throw new Error(`ADMIN_BOOTSTRAP_${field === "password" ? "PASSWORD" : "EMAIL"} is not valid: ${input.error.issues[0]?.message}`);
  }
  await accounts.create(input.data, { address: "bootstrap" });
  return "created";
}
