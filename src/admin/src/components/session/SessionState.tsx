import { useEffect } from "react";
import { useAuditTail } from "@/hooks/useAuditTail";

/** Reads what a session needs once it starts: today the newest page of the audit log for the Events drawer. It draws
 *  nothing. `AppShell` mounts it only while signed in and keys it on the session's serial, so a new sign-in reads again
 *  and a sign-out leaves nothing behind. Wave 4 adds the account state's hydration here. */
export function SessionState() {
  const { reload } = useAuditTail();
  useEffect(() => {
    void reload();
  }, [reload]);
  return null;
}
