import type { z } from "zod";
import { ApiError } from "./api-error";
import type { ApiErrorExtras } from "./api-error";
import { errorSentence } from "./error-sentence";
import { EnvelopeSchema } from "./envelope-schema";
import type { ApiClient, ApiConfig, HttpMethod, RequestOptions, RequestStatus } from "./request-types";

const JSON_TYPE = "application/json";

type Read = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

async function readJson(response: Response): Promise<Read> {
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false };
  }
}

interface ErrorBody {
  readonly details?: Readonly<Record<string, unknown>>;
  readonly correlationId?: string;
}

/** The field a validation refusal names and the correlation id; a `field` that is not a string is ignored. */
function extrasOf(error: ErrorBody | undefined): ApiErrorExtras {
  const field = error?.details?.["field"];
  return {
    ...(typeof field === "string" && { field }),
    ...(error?.correlationId !== undefined && { correlationId: error.correlationId }),
  };
}

/** The request layer of one program (`01` section 4.1): `api` decodes the standard envelope and validates its data,
 *  `apiStream` returns a streamed body after a refusal check. React-free; the program supplies the sentences, the
 *  failure codes, the headers and what to do with each finished request. */
export function createApi<Area extends string>(config: ApiConfig<Area>): ApiClient<Area> {
  const clock = config.now ?? (() => performance.now());
  const send = config.fetch ?? ((input: string, requestInit?: RequestInit) => fetch(input, requestInit));
  const base = config.base ?? "";
  const { sentences, failureCodes } = config;

  const invalid = (status: number): ApiError =>
    new ApiError(failureCodes.invalid, errorSentence(sentences, failureCodes.invalid), status);
  const unreachable = (): ApiError =>
    new ApiError(failureCodes.unreachable, errorSentence(sentences, failureCodes.unreachable));
  const refused = (code: string, message: string, status: number, error?: ErrorBody): ApiError =>
    new ApiError(code, errorSentence(sentences, code, message), status, extrasOf(error));

  function target(path: string): string {
    if (!path.startsWith("/api/")) throw new TypeError("API paths must be relative and begin /api/.");
    return `${base}${path}`;
  }

  function init(method: HttpMethod, options: RequestOptions<Area>): RequestInit {
    const headers: Record<string, string> = { ...config.headers?.() };
    if (options.body !== undefined && options.form === undefined) headers["content-type"] = JSON_TYPE;
    return {
      method,
      signal: options.signal,
      headers,
      ...(options.keepalive === true && { keepalive: true }),
      ...(options.form !== undefined
        ? { body: options.form }
        : options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
    };
  }

  function report(
    method: HttpMethod,
    area: Area,
    options: RequestOptions<Area>,
    started: number,
    status: RequestStatus,
  ): void {
    const succeeded = typeof status === "number" && status < 400;
    if (options.quiet === true && succeeded) return;
    config.onEvent?.({ method, status, elapsedMs: clock() - started, area });
  }

  async function refusal(response: Response): Promise<ApiError> {
    const read = await readJson(response);
    const parsed = read.ok ? EnvelopeSchema.safeParse(read.value) : null;
    if (parsed === null || !parsed.success || parsed.data.ok) return invalid(response.status);
    const { error } = parsed.data;
    return refused(error.code, error.message, response.status, error);
  }

  async function api<T>(path: string, schema: z.ZodType<T>, options: RequestOptions<Area> = {}): Promise<T> {
    const url = target(path);
    const method = options.method ?? "GET";
    const area = options.area ?? config.defaultArea;
    const started = clock();
    let status: RequestStatus = "unreachable";
    try {
      const response = await send(url, init(method, options));
      status = response.status;
      if (response.status === 401) config.onUnauthorized?.();
      const read = await readJson(response);
      const parsed = read.ok ? EnvelopeSchema.safeParse(read.value) : null;
      if (parsed === null || !parsed.success) {
        status = "invalid";
        throw invalid(response.status);
      }
      const envelope = parsed.data;
      if (!envelope.ok) {
        throw refused(envelope.error.code, envelope.error.message, response.status, envelope.error);
      }
      const data = schema.safeParse(envelope.data);
      if (!data.success) {
        status = "invalid";
        throw invalid(response.status);
      }
      return data.data;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        status = "aborted";
        throw error;
      }
      throw unreachable();
    } finally {
      report(method, area, options, started, status);
    }
  }

  async function apiStream(path: string, options: RequestOptions<Area> = {}): Promise<ReadableStream<Uint8Array>> {
    const url = target(path);
    const method = options.method ?? "GET";
    const area = options.area ?? config.defaultArea;
    const started = clock();
    let status: RequestStatus = "unreachable";
    try {
      const response = await send(url, init(method, options));
      status = response.status;
      if (response.status === 401) config.onUnauthorized?.();
      if (!response.ok) throw await refusal(response);
      if (response.body === null) {
        status = "invalid";
        throw invalid(response.status);
      }
      return response.body;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        status = "aborted";
        throw error;
      }
      throw unreachable();
    } finally {
      report(method, area, options, started, status);
    }
  }

  return { api, apiStream };
}
