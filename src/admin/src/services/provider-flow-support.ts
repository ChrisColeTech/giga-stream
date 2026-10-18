import { ApiError } from "@giga/http/api-error";
import { FAILURE_CODES } from "@/constants/api-sentences";
import { REQUEST_FAILED } from "@/constants/provider-copy";
import type { EventArea } from "@/types/events";

/* What the Providers and Titles flows share (`37` section 5): the typed results, and how a failure becomes one warn
 * notice plus, when the backend named a field, a refusal under that row. Pure of the store: each tab's flows pass the
 * notice line and their own "mark unreachable". */

export interface FlowOk<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FlowRefused<F extends string = string> {
  readonly ok: false;
  readonly sentence: string;
  readonly field?: F;
  /** The answer belonged to an earlier session (or an older view) and was thrown away: nothing written, nothing said. */
  readonly dropped?: true;
}

export type FlowResult<T = undefined, F extends string = string> = FlowOk<T> | FlowRefused<F>;

export const DROPPED: FlowRefused<never> = { ok: false, sentence: "", dropped: true };

export const done = <T>(value: T): FlowOk<T> => ({ ok: true, value });

export const codeOf = (error: unknown): string | null => (error instanceof ApiError ? error.code : null);

/** The sentence a failure shows: the request layer's own, or the generic one for anything else. */
export const sentenceOf = (error: unknown): string => (error instanceof ApiError ? error.message : REQUEST_FAILED);

export const isUnreachable = (error: unknown): boolean => codeOf(error) === FAILURE_CODES.unreachable;

export interface RefusalPorts<F extends string> {
  readonly say: (sentence: string, tone: "warn", area: EventArea) => void;
  readonly markUnreachable: () => void;
  readonly area: EventArea;
  /** The backend's field name as the form's row, or undefined when the form has no such row. */
  readonly fieldOf: (field: string | undefined) => F | undefined;
}

/** A failure, said once on the notice line (`warn`) and, when the backend named one of the form's fields, returned with
 *  that field. A transport failure also marks the backend unreachable, which disables every write until a read works. */
export function refusalOf<F extends string>(ports: RefusalPorts<F>, error: unknown, fallback?: F): FlowRefused<F> {
  const sentence = sentenceOf(error);
  const unreachable = isUnreachable(error);
  if (unreachable) ports.markUnreachable();
  ports.say(sentence, "warn", unreachable ? "Connection" : ports.area);
  const field = (error instanceof ApiError ? ports.fieldOf(error.field) : undefined) ?? fallback;
  return { ok: false, sentence, ...(field !== undefined && { field }) };
}
