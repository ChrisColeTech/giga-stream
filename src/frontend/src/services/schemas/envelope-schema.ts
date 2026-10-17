import { z } from "zod";

export const ErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string().regex(/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
    correlationId: z.string().optional(),
  }),
});

export const SuccessEnvelopeSchema = z.object({ ok: z.literal(true), data: z.unknown() });
export const EnvelopeSchema = z.discriminatedUnion("ok", [SuccessEnvelopeSchema, ErrorEnvelopeSchema]);
