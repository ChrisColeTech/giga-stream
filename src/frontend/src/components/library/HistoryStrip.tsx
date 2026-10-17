import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CLEAR_WINDOW_MS } from "@/lib/library-limits";
import { LIBRARY_COPY } from "@/lib/library-copy";

export interface HistoryStripProps {
  readonly empty: boolean;
  readonly onClear: () => void;
}

/** The strip under the type strip in History: Clear history is two-step. The first press arms it and names the
 *  consequence; the second press within four seconds clears. Focus loss and Escape disarm it. */
export function HistoryStrip({ empty, onClear }: HistoryStripProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), CLEAR_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const press = (): void => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onClear();
  };

  return (
    <div
      className="flex flex-none items-center justify-end border-b border-hair px-3 py-1.5"
      onKeyDown={(event) => {
        if (event.key === "Escape") setArmed(false);
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setArmed(false);
      }}
    >
      <Button
        size="sm"
        variant={armed ? "danger" : "default"}
        disabled={empty}
        title={empty ? LIBRARY_COPY.clearEmpty : armed ? LIBRARY_COPY.clearHint : undefined}
        onClick={press}
      >
        {armed ? LIBRARY_COPY.clearArmed : LIBRARY_COPY.clearIdle}
      </Button>
    </div>
  );
}
