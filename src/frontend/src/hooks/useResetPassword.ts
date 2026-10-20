import { useCallback, useRef, type Dispatch } from "react";
import type { ResetEvent } from "@/lib/reset-state";
import { newPasswordRefusal } from "@/lib/reset-verb";
import { authPort } from "@/services/auth-port";
import type { ResetResult } from "@/types/auth";

/** The Reset password verb: checks the new password first (a refusal sits under its row and nothing is sent), then
 *  marks the view waiting, awaits the port (`POST /api/admin/auth-security/reset`, no token) and hands the answer to
 *  the state machine. The answer is sent as typed; the backend normalises it. Answers the result so the form can
 *  clear its fields, or null when nothing was sent. A second call while one waits sends nothing. */
export function useResetPassword(
  dispatch: Dispatch<ResetEvent>,
): (username: string, answer: string, newPassword: string) => Promise<ResetResult | null> {
  const waiting = useRef(false);

  return useCallback(
    async (username, answer, newPassword) => {
      if (waiting.current) return null;
      const refusal = newPasswordRefusal(newPassword);
      if (refusal !== null) {
        dispatch({ type: "refused", field: "newPassword", sentence: refusal });
        return null;
      }
      waiting.current = true;
      dispatch({ type: "submit" });
      const result = await authPort
        .resetPassword(username, answer, newPassword)
        .catch((): ResetResult => ({ ok: false, refusal: "unreachable" }));
      waiting.current = false;
      dispatch({ type: "finished", result });
      return result;
    },
    [dispatch],
  );
}
