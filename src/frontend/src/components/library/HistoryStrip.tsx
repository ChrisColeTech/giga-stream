import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { LIBRARY_COPY } from "@/lib/library-copy";

export interface HistoryStripProps {
  readonly empty: boolean;
  readonly onClear: () => void;
}

/** The strip under the toolbar in History: Clear history, the app's one inline two-step (`ArmedButton`). */
export function HistoryStrip({ empty, onClear }: HistoryStripProps) {
  const button = (
    <ArmedButton question={LIBRARY_COPY.clearArmed} disabled={empty}
      title={empty ? undefined : LIBRARY_COPY.clearTip} onConfirm={onClear}>
      {LIBRARY_COPY.clearIdle}
    </ArmedButton>
  );
  return (
    <div className="flex flex-none items-center justify-end border-b border-hair px-3 py-1.5">
      {empty
        ? <Tooltip text={LIBRARY_COPY.clearEmpty} focusable
            label={`${LIBRARY_COPY.clearIdle}. ${LIBRARY_COPY.clearEmpty}`}>{button}</Tooltip>
        : button}
    </div>
  );
}
