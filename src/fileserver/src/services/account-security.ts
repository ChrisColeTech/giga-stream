import { createHmac, createHmac as hmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const QUESTIONS = [
  "What was the name of your first pet?", "In what city were you born?",
  "What was the name of your first school?", "What is your mother's maiden name?",
  "What was the make of your first car?", "What was the name of the street you grew up on?",
  "What was your childhood nickname?", "What is your favourite book?",
] as const;
const ISSUER = "giga-stream-admin";
const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const Claims = z.object({
  iss: z.literal(ISSUER), aud: z.literal(ISSUER), sub: z.string(), ver: z.number().int(),
  iat: z.number().int(), exp: z.number().int(),
});

export const normaliseAnswer = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
export const usernameKey = (value: string): string => value.trim().toLowerCase();

export function questionText(question: number): string {
  const value = QUESTIONS[question - 1];
  if (value === undefined) throw new Error("invalid security question");
  return value;
}

export function decoyQuestion(secret: string, username: string): string {
  const digest = createHmac("sha256", secret).update(`reset-decoy:${usernameKey(username)}`).digest("hex");
  return questionText(Number(BigInt(`0x${digest}`) % BigInt(QUESTIONS.length)) + 1);
}

export function signAccessToken(sub: string, version: number, now: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({
    iss: ISSUER, aud: ISSUER, sub, ver: version, iat: Math.floor(now / 1000),
    exp: Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000),
  })).toString("base64url");
  const signature = hmac("sha256", secret).update(`${HEADER}.${payload}`).digest("base64url");
  return `${HEADER}.${payload}.${signature}`;
}

export function verifyAccessToken(token: string, secret: string, now: number): z.infer<typeof Claims> | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [header, payload, signature] = parts as [string, string, string];
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return undefined; }
  const expected = hmac("sha256", secret).update(`${header}.${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (header !== HEADER || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  const claims = Claims.safeParse(decoded);
  return claims.success && claims.data.exp * 1000 > now ? claims.data : undefined;
}
