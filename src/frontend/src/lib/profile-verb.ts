import { PROFILE_USERNAME_LONG, PROFILE_USERNAME_REQUIRED, PROFILE_WAITING } from "@/constants/profile-copy";

export function profileUsernameError(username: string): string | null {
  if (username.trim() === "") return PROFILE_USERNAME_REQUIRED;
  return username.trim().length > 254 ? PROFILE_USERNAME_LONG : null;
}

export function profileUpdateReason(username: string, busy: boolean): string | undefined {
  if (busy) return PROFILE_WAITING;
  return profileUsernameError(username) ?? undefined;
}
