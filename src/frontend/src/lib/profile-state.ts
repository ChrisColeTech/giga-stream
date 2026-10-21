import { PROFILE_INVALID, PROFILE_UNREACHABLE, PROFILE_USERNAME_TAKEN } from "@/constants/profile-copy";
import type { ProfileResult } from "@/types/auth";

export interface ProfileState {
  readonly busy: boolean;
  readonly requestId: number | null;
  readonly error: string | null;
}

export type ProfileEvent =
  | { readonly type: "submit"; readonly requestId: number }
  | { readonly type: "refused"; readonly sentence: string }
  | { readonly type: "answered"; readonly requestId: number; readonly result: ProfileResult }
  | { readonly type: "reset" };

export const PROFILE_START: ProfileState = { busy: false, requestId: null, error: null };

function sentenceOf(result: Exclude<ProfileResult, { ok: true }>): string {
  if (result.refusal === "usernameTaken") return PROFILE_USERNAME_TAKEN;
  return result.refusal === "invalid" ? PROFILE_INVALID : PROFILE_UNREACHABLE;
}

export function nextProfile(state: ProfileState, event: ProfileEvent): ProfileState {
  switch (event.type) {
    case "submit":
      return state.busy ? state : { busy: true, requestId: event.requestId, error: null };
    case "refused":
      return state.busy ? state : { ...state, error: event.sentence };
    case "answered":
      if (!state.busy || state.requestId !== event.requestId) return state;
      return { busy: false, requestId: null, error: event.result.ok ? null : sentenceOf(event.result) };
    case "reset":
      return PROFILE_START;
  }
}
