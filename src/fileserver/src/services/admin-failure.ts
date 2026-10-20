import type { AppErrorCode } from "../types/envelope.js";

export interface AdminFailure {
  code: Extract<AppErrorCode, "backend.unreachable" | "backend.bad_response" | "title.not_found">;
  message: string;
  status: number;
}

export type AdminResult<T> = { ok: true; value: T } | { ok: false; failure: AdminFailure };

export const unreachable: AdminFailure = {
  code: "backend.unreachable",
  message: "The admin database did not answer.",
  status: 503,
};

export const badResponse: AdminFailure = {
  code: "backend.bad_response",
  message: "The admin database contains data this app cannot use.",
  status: 502,
};

export const titleNotFound: AdminFailure = {
  code: "title.not_found",
  message: "There is no such title.",
  status: 404,
};
