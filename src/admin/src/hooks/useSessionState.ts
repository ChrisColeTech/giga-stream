import { useEffect } from "react";
import { useAuditTail } from "./useAuditTail";

/** Reads what a session needs once it starts: today the newest page of the audit log for the Events drawer. `AppShell`
 *  calls it with the session's serial, so a new sign-in reads again; signed out it reads nothing, and a sign-out leaves
 *  nothing behind. */
export function useSessionState(signedIn: boolean, serial: number): void {
  const { reload } = useAuditTail();
  useEffect(() => {
    if (signedIn) void reload();
  }, [signedIn, serial, reload]);
}
