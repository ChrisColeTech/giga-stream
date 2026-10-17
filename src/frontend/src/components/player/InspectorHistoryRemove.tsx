import { useEffect, useState } from "react";
import { PlayerRow } from "@/components/player/PlayerRow";
import { Button } from "@/components/ui/Button";
import { CONFIRM_REMOVE_LABEL, NO_WATCH_ENTRY_REASON, REMOVE_HISTORY_LABEL } from "@/lib/player-copy";
import { ARM_TIMEOUT_MS, nextTwoStep, type TwoStepPhase } from "@/lib/collections-two-step";

export interface InspectorHistoryRemoveProps {
  /** The watch entry this title has; absent when the library holds none, which leaves nothing to remove. */
  readonly watchId: string | undefined;
  readonly onRemove: (watchId: string) => void;
}

/** Remove from History (`06` sections 2 and 5.4): an inline two-step. The first press arms the same control; the second
 *  removes the entry. A timeout disarms it. With no watch entry there is nothing to act on, so it is off with its reason. */
export function InspectorHistoryRemove({ watchId, onRemove }: InspectorHistoryRemoveProps) {
  const [phase, setPhase] = useState<TwoStepPhase>("idle");
  const armed = phase === "armed" && watchId !== undefined;

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setPhase(nextTwoStep("timeout")), ARM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (watchId === undefined) {
    return (
      <PlayerRow label="History" disabled reason={NO_WATCH_ENTRY_REASON}>
        <span title={NO_WATCH_ENTRY_REASON} className="inline-flex">
          <Button size="sm" disabled>
            {REMOVE_HISTORY_LABEL}
          </Button>
        </span>
      </PlayerRow>
    );
  }

  return (
    <PlayerRow label="History">
      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          if (!armed) {
            setPhase(nextTwoStep("press"));
            return;
          }
          onRemove(watchId);
        }}
        onBlur={() => setPhase(nextTwoStep("blur"))}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !armed) return;
          event.preventDefault();
          event.stopPropagation();
          setPhase(nextTwoStep("escape"));
        }}
      >
        {armed ? CONFIRM_REMOVE_LABEL : REMOVE_HISTORY_LABEL}
      </Button>
    </PlayerRow>
  );
}
