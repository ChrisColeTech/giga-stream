import { createHmac } from "node:crypto";

import { RESET_DECOY_PREFIX, SECURITY_QUESTIONS } from "../constants/security-questions.js";

/**
 * An answer as it is hashed and compared (docs/40 section 2.2): NFKC, trimmed, inner runs of white space made one
 * space, lower-cased. So `  Rex  `, `rex` and `REX` are one answer. An empty result is no answer at all.
 */
export const normaliseAnswer = (answer: string): string =>
  answer.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

/** The backend's own form of an email for lookups and the attempt counter: trimmed and lower-cased. */
export const emailKeyOf = (email: string): string => email.trim().toLowerCase();

/** The text of a picklist question by its stored number (1 to 8). */
export function questionText(question: number): string {
  const text = SECURITY_QUESTIONS[question - 1];
  if (text === undefined) throw new Error(`no security question ${question}`);
  return text;
}

/**
 * The decoy question an email with no account, or an account with no question, is shown (docs/40 section 2.4):
 * HMAC-SHA256 of `reset-decoy:<emailKey>` under the JWT secret, taken as an unsigned integer modulo eight. The
 * same email always gets the same question, and without the secret nobody can tell which one it will be.
 */
export function decoyQuestion(secret: string, emailKey: string): string {
  const digest = createHmac("sha256", secret).update(RESET_DECOY_PREFIX + emailKey).digest("hex");
  const index = Number(BigInt(`0x${digest}`) % BigInt(SECURITY_QUESTIONS.length));
  return questionText(index + 1);
}
