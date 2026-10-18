import { ApiError } from "@giga/http/api-error";
import { REQUEST_FAILED } from "@/constants/account-copy";
import { FAILURE_CODES } from "@/constants/api-sentences";

/* The typed results the Playlists and Jobs flows answer (`38` section 6), as the Accounts flows do: ok with a value, or
 * refused with the sentence and, when the backend or the page named one of the form's rows, that row. A dropped result
 * belongs to an earlier session: nothing was written and nothing is said. Pure. */

export interface FlowOk<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FlowRefused<F extends string = string> {
  readonly ok: false;
  readonly sentence: string;
  readonly field?: F;
  readonly dropped?: true;
}

export type FlowResult<T = undefined, F extends string = string> = FlowOk<T> | FlowRefused<F>;

export const DROPPED: FlowRefused<never> = { ok: false, sentence: "", dropped: true };

export const done = <T>(value: T): FlowOk<T> => ({ ok: true, value });

export const codeOf = (error: unknown): string | null => (error instanceof ApiError ? error.code : null);

export const sentenceOf = (error: unknown): string => (error instanceof ApiError ? error.message : REQUEST_FAILED);

export const isUnreachable = (error: unknown): boolean => codeOf(error) === FAILURE_CODES.unreachable;

export const BAD_ANSWER = FAILURE_CODES.invalid;

/** The row a refusal sits under: the backend's `details.field` when the form has that row (a dotted `config.pages`
 *  names `pages`), else the fallback. */
export function fieldOf<F extends string>(error: unknown, rows: readonly F[], fallback?: F): F | undefined {
  const named = error instanceof ApiError ? error.field : undefined;
  const last = named?.split(".").at(-1);
  return rows.find((row) => row === named || row === last) ?? fallback;
}
