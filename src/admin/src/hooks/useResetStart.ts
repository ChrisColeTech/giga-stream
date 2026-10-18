import { useCallback, useRef, type Dispatch } from "react";
import type { ResetEvent } from "@/lib/reset-state";
import { authPort } from "@/services/auth";
import type { ResetStartResult } from "@/types/auth";

/** The Continue verb: marks the view waiting, awaits the port (`POST /api/auth/reset-start`, no token) and hands the
 *  answer to the view's state machine. A port that rejects counts as unreachable. A second call while one waits sends
 *  nothing. The store holds no promise. */
export function useResetStart(dispatch: Dispatch<ResetEvent>): (username: string) => Promise<void> {
  const waiting = useRef(false);

  return useCallback(
    async (username) => {
      if (waiting.current) return;
      waiting.current = true;
      dispatch({ type: "submit" });
      const typed = username.trim();
      const result = await authPort
        .resetStart(typed)
        .catch((): ResetStartResult => ({ ok: false, refusal: "unreachable" }));
      waiting.current = false;
      dispatch({ type: "started", username: typed, result });
    },
    [dispatch],
  );
}
