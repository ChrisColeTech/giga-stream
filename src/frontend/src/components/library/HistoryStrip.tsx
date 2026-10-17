import { Button } from "@/components/ui/Button";
import { useArmedAction } from "@/hooks/useArmedAction";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { CLEAR_WINDOW_MS } from "@/lib/library-limits";

export interface HistoryStripProps {
  readonly empty: boolean;
  readonly onClear: () => void;
}

/** The strip under the type strip in History: Clear history is two-step. The first press arms it and names the
 *  consequence; the second press within four seconds clears. Focus loss and Escape disarm it. */
export function HistoryStrip({ empty, onClear }: HistoryStripProps) {
  const { armed, arm, disarm } = useArmedAction(CLEAR_WINDOW_MS);

  const press = (): void => {
    if (!armed) {
      arm();
      return;
    }
    disarm();
    onClear();
  };

  return (
    <div
      className="flex flex-none items-center justify-end border-b border-hair px-3 py-1.5"
      onKeyDown={(event) => {
        if (event.key === "Escape") disarm();
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) disarm();
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
