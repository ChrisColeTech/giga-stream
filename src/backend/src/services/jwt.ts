import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Access tokens (docs/03 section 7.12): JWTs signed with HS256 only. Verification accepts exactly the
 * header this module writes; any other algorithm (including `none`) is refused before the signature is
 * looked at, and the signature is compared in constant time.
 */
export const ISSUER = "giga-stream-admin";
export const AUDIENCE = "giga-stream-admin";

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

export const ClaimsSchema = z.object({
  iss: z.literal(ISSUER),
  aud: z.literal(AUDIENCE),
  sub: z.string().min(1),
  ver: z.number().int().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type Claims = z.infer<typeof ClaimsSchema>;

const HeaderSchema = z.object({ alg: z.literal("HS256"), typ: z.literal("JWT").optional() }).strict();

const sign = (input: string, secret: string): Buffer => createHmac("sha256", secret).update(input).digest();

export function signAccessToken(claims: Claims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign(`${HEADER}.${payload}`, secret).toString("base64url");
  return `${HEADER}.${payload}.${signature}`;
}

function decodeJson(part: string): unknown {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf-8"));
  } catch {
    return undefined;
  }
}

/** The token's claims when it is well-formed, correctly signed, from us, for us and not expired. */
export function verifyAccessToken(token: string, secret: string, nowMs: number): Claims | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [header, payload, signature] = parts as [string, string, string];
  if (!HeaderSchema.safeParse(decodeJson(header)).success) return undefined;
  const expected = sign(`${header}.${payload}`, secret);
  const presented = Buffer.from(signature, "base64url");
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return undefined;
  const claims = ClaimsSchema.safeParse(decodeJson(payload));
  if (!claims.success) return undefined;
  return claims.data.exp * 1000 > nowMs ? claims.data : undefined;
}
