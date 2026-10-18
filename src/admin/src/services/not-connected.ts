import { ApiError } from "@giga/http/api-error";
import { ERROR_SENTENCES, NOT_CONNECTED_CODE } from "@/constants/api-sentences";

/** What a service whose route is not wired yet answers (`28` rule: wire to stub methods, never to fixtures). It rejects
 *  with a typed `ApiError` the page shows as a visible refusal: the sentence on the notice line, the skeleton staying, the
 *  control disabled with its reason. Replacing a stub body with the real call changes no page. */
export function notConnected(what: string): Promise<never> {
  void what;
  return Promise.reject(new ApiError(NOT_CONNECTED_CODE, ERROR_SENTENCES[NOT_CONNECTED_CODE] ?? "Not connected."));
}

export const isNotConnected = (error: unknown): boolean => error instanceof ApiError && error.code === NOT_CONNECTED_CODE;
