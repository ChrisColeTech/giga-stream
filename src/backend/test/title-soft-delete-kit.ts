/** Helper for the soft-delete tests: the audit log's actions. */
import { pick, send, type TestApp } from "./test-app.js";

/** The audit log's actions, newest first. */
export async function actionsOf(t: TestApp, token: string): Promise<string[]> {
  const items = pick((await send(t.app, "GET", "/api/audit?limit=20", undefined, token)).body, "data.items");
  return (items as Array<Record<string, unknown>>).map((entry) => String(entry.action));
}
