import { cn } from "@giga/ui/lib/cn";
import type { RowState, StateTone } from "@/lib/row-state";

const TONE: Readonly<Record<StateTone, string>> = {
  done: "text-st-done",
  loading: "text-st-loading",
  failed: "text-st-failed",
  faint: "text-faint",
  accent: "text-accent-text",
};

/** A record's state as its word in the tone's colour (`28` section 9, item 2): `enabled`, `disabled`, `live`... Always a
 *  word, never a dot. `data-st` is on the cell so a test (and a stylesheet) can find the state. */
export function StateWord({ state }: { readonly state: RowState }) {
  return (
    <span data-st={state.word} title={state.hint} className={cn("truncate font-mono text-xs", TONE[state.tone])}>
      {state.word}
    </span>
  );
}
