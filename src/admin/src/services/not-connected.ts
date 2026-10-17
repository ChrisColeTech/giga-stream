/** The answer every fileserver method gives in phase 1: the interface has no connection yet. A press that needs the
 *  fileserver reports this once on the notice line (`04` section 6). Phase 2 replaces the stub bodies with real calls, and
 *  this answer stays for the case when the fileserver cannot be reached. */
export const NOT_CONNECTED_MESSAGE = "The fileserver is not connected.";

export type ServiceResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

export function notConnected(): ServiceResult {
  return { ok: false, message: NOT_CONNECTED_MESSAGE };
}
