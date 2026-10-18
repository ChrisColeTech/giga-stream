// Shared steps of the security-question reset tests (docs/40 section 3.4): set a question, ask for it, answer it,
// read the stored answer hash and the audit log.
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { ADMIN_PASSWORD, pick, send, type Answer } from "./test-app.js";

export const QUESTION_ONE = "What was the name of your first pet?";
export const NEW_PASSWORD = "brand-new-password-456";

export const code = (answer: { body: unknown }): unknown => pick(answer.body, "error.code");

export function setQuestion(
  app: FastifyInstance,
  token: string,
  answer: string,
  question = 1,
  currentPassword = ADMIN_PASSWORD,
): Promise<Answer> {
  return send(app, "PUT", "/api/auth/me/security-question", { currentPassword, question, answer }, token);
}

export const resetStart = (app: FastifyInstance, username: string): Promise<Answer> =>
  send(app, "POST", "/api/auth/reset-start", { username });

export const resetWith = (
  app: FastifyInstance,
  username: string,
  answer: string,
  newPassword = NEW_PASSWORD,
): Promise<Answer> => send(app, "POST", "/api/auth/reset", { username, answer, newPassword });

/** The stored answer hash of an account, read from the database file. */
export function storedAnswerHash(dataDir: string, username: string): unknown {
  const db = new DatabaseSync(path.join(dataDir, DATABASE_FILE_NAME), { readOnly: true });
  try {
    const sql = "SELECT security_answer_hash AS h FROM admin_accounts WHERE username_key = ?";
    const row = db.prepare(sql).get(username.toLowerCase());
    return row?.h;
  } finally {
    db.close();
  }
}

/** Every audit entry, newest first. */
export async function auditEntries(app: FastifyInstance, token: string): Promise<Record<string, unknown>[]> {
  const answer = await send(app, "GET", "/api/audit?limit=200", undefined, token);
  const items = pick(answer.body, "data.items");
  return Array.isArray(items) ? items.filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null) : [];
}

/** Makes a second account and answers its id. */
export async function makeAccount(app: FastifyInstance, token: string, username: string): Promise<string> {
  const made = await send(app, "POST", "/api/admin-accounts", { username, password: ADMIN_PASSWORD }, token);
  if (made.status !== 201) throw new Error(`account not created: ${JSON.stringify(made.body)}`);
  return String(pick(made.body, "data.id"));
}
