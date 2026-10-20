import {
  REGISTRATION_INVALID,
  REGISTRATION_UNREACHABLE,
  REGISTRATION_USERNAME_TAKEN,
} from "@/constants/registration-copy";
import type { RegistrationResult } from "@/types/auth";
import type { RegistrationError } from "./registration-verb";

export interface RegistrationState {
  readonly busy: boolean;
  readonly requestId: number | null;
  readonly error: RegistrationError | null;
}

export type RegistrationEvent =
  | { readonly type: "submit"; readonly requestId: number }
  | { readonly type: "refused"; readonly error: RegistrationError }
  | { readonly type: "answered"; readonly requestId: number; readonly result: RegistrationResult }
  | { readonly type: "reset" };

export const REGISTRATION_START: RegistrationState = { busy: false, requestId: null, error: null };

function resultError(result: Exclude<RegistrationResult, { ok: true }>): RegistrationError {
  if (result.refusal === "usernameTaken") {
    return { field: "username", sentence: REGISTRATION_USERNAME_TAKEN };
  }
  return {
    field: "form",
    sentence: result.refusal === "invalid" ? REGISTRATION_INVALID : REGISTRATION_UNREACHABLE,
  };
}

/** Request ids make a late answer inert after reset or after a newer request. */
export function nextRegistration(state: RegistrationState, event: RegistrationEvent): RegistrationState {
  switch (event.type) {
    case "submit":
      return state.busy ? state : { busy: true, requestId: event.requestId, error: null };
    case "refused":
      return state.busy ? state : { ...state, error: event.error };
    case "answered":
      if (!state.busy || state.requestId !== event.requestId) return state;
      return {
        busy: false,
        requestId: null,
        error: event.result.ok ? null : resultError(event.result),
      };
    case "reset":
      return REGISTRATION_START;
  }
}
