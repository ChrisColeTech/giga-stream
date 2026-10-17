import type { z } from "zod";
import { errorSentence } from "@/lib/error-sentence";
import { restEvent } from "@/lib/event-log";
import { useAppStore } from "@/store/app-store";
import type { EventArea } from "@/types/events";
import { EnvelopeSchema } from "./schemas/envelope-schema";

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export interface ApiOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  readonly area?: EventArea;
  /** Lets the request outlive the page (a write made as the window closes). */
  readonly keepalive?: boolean;
  /** A success adds no Events row (a periodic progress write); a failure still does. */
  readonly quiet?: boolean;
}

async function refusal(response: Response): Promise<ApiError> {
  let wire: unknown;
  try {
    wire = await response.json();
  } catch {
    return new ApiError("response.invalid", errorSentence("response.invalid"), response.status);
  }
  const parsed = EnvelopeSchema.safeParse(wire);
  if (!parsed.success || parsed.data.ok) {
    return new ApiError("response.invalid", errorSentence("response.invalid"), response.status);
  }
  return new ApiError(
    parsed.data.error.code,
    errorSentence(parsed.data.error.code, parsed.data.error.message),
    response.status,
  );
}

export async function api<T>(path: string, schema: z.ZodType<T>, options: ApiOptions = {}): Promise<T> {
  if (!path.startsWith("/api/")) throw new TypeError("API paths must be relative and begin /api/.");
  const method = options.method ?? "GET";
  const started = performance.now();
  let status: number | "aborted" | "invalid" | "unreachable" = "unreachable";
  try {
    const response = await fetch(path, {
      method,
      signal: options.signal,
      ...(options.keepalive === true && { keepalive: true }),
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    status = response.status;
    let wire: unknown;
    try {
      wire = await response.json();
    } catch {
      status = "invalid";
      throw new ApiError("response.invalid", errorSentence("response.invalid"), response.status);
    }
    const parsedEnvelope = EnvelopeSchema.safeParse(wire);
    if (!parsedEnvelope.success) {
      status = "invalid";
      throw new ApiError("response.invalid", errorSentence("response.invalid"), response.status);
    }
    const envelope = parsedEnvelope.data;
    if (!envelope.ok) {
      throw new ApiError(envelope.error.code, errorSentence(envelope.error.code, envelope.error.message), response.status);
    }
    const parsedData = schema.safeParse(envelope.data);
    if (!parsedData.success) {
      status = "invalid";
      throw new ApiError("response.invalid", errorSentence("response.invalid"), response.status);
    }
    return parsedData.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      status = "aborted";
      throw error;
    }
    throw new ApiError("fileserver.unreachable", errorSentence("fileserver.unreachable"));
  } finally {
    const succeeded = typeof status === "number" && status < 400;
    if (!(options.quiet === true && succeeded)) {
      useAppStore.getState().logEvent(restEvent(method, status, performance.now() - started, options.area ?? "Connection"));
    }
  }
}

/** The scan is the only route whose successful answer is a streamed body rather than an envelope. */
export async function apiStream(path: string, options: ApiOptions = {}): Promise<ReadableStream<Uint8Array>> {
  if (!path.startsWith("/api/")) throw new TypeError("API paths must be relative and begin /api/.");
  const method = options.method ?? "GET";
  const started = performance.now();
  let status: number | "aborted" | "invalid" | "unreachable" = "unreachable";
  try {
    const response = await fetch(path, { method, signal: options.signal });
    status = response.status;
    if (!response.ok) throw await refusal(response);
    if (response.body === null) {
      status = "invalid";
      throw new ApiError("response.invalid", errorSentence("response.invalid"), response.status);
    }
    return response.body;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      status = "aborted";
      throw error;
    }
    throw new ApiError("fileserver.unreachable", errorSentence("fileserver.unreachable"));
  } finally {
    useAppStore.getState().logEvent(restEvent(method, status, performance.now() - started, options.area ?? "Connection"));
  }
}
