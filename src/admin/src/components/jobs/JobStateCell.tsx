import { StateWord } from "@/components/records/StateWord";
import type { RowState } from "@/lib/row-state";
import { RunningBar } from "./RunningBar";

/** The Jobs table's state cell: the state word and, while the job runs, the pulsing 48px bar beside it. */
export function JobStateCell({ state }: { readonly state: RowState }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <StateWord state={state} />
      {state.word === "running" && <RunningBar />}
    </span>
  );
}
