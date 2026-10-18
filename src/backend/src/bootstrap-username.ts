/** The two environment names the first admin's sign-in name may come from. */
export interface BootstrapNames {
  ADMIN_BOOTSTRAP_USERNAME?: string | undefined;
  /** The name used before sign-in became a username; read only when the new one is not set. */
  ADMIN_BOOTSTRAP_EMAIL?: string | undefined;
}

/**
 * The first admin's username (docs/03 section 7.11): `ADMIN_BOOTSTRAP_USERNAME`, or `ADMIN_BOOTSTRAP_EMAIL` when only
 * that old name is set, so an existing `.env` keeps working. Empty when neither is set.
 */
export function bootstrapUsername(names: BootstrapNames): string {
  const username = names.ADMIN_BOOTSTRAP_USERNAME?.trim() ?? "";
  return username !== "" ? username : (names.ADMIN_BOOTSTRAP_EMAIL?.trim() ?? "");
}
