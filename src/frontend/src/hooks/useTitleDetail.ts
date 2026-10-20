import { useEffect, useState } from "react";
import { readTitle } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import type { TitleDetail } from "@/types/title";

export interface TitleDetailRead {
  /** Absent while the read is under way, and when it failed. */
  readonly detail: TitleDetail | undefined;
  readonly pending: boolean;
}

/** One title's detail (`GET /api/titles/:id`, the read Title information and the Player make), read when the component
 *  mounts and abandoned when it unmounts. A failed read is said once, as the other readers say theirs. */
export function useTitleDetail(
  titleId: string | undefined,
  failureMessage = "Title details could not be read.",
): TitleDetailRead {
  const [read, setRead] = useState<TitleDetailRead>({ detail: undefined, pending: true });

  useEffect(() => {
    if (titleId === undefined) {
      setRead({ detail: undefined, pending: false });
      return;
    }
    const controller = new AbortController();
    setRead({ detail: undefined, pending: true });
    void readTitle(titleId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) setRead({ detail, pending: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRead({ detail: undefined, pending: false });
        useAppStore.getState().say(error instanceof Error ? error.message : failureMessage, "warn");
      });
    return () => controller.abort();
  }, [failureMessage, titleId]);

  return read;
}
