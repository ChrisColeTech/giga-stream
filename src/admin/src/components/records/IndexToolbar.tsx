import { Toolbar } from "@giga/ui/layout/Toolbar";
import { useForwardVerbs } from "@/hooks/useForwardVerbs";
import type { ToolbarVerb } from "@/lib/workspace-verbs";
import type { Tab } from "@/types/shell";
import { ForwardButton } from "./ForwardButton";
import { PromoteButton } from "./PromoteButton";

/** An index's page toolbar (LoRA Trainer `pages/datasets/DatasetsIndex.tsx` 64-70): ONLY the page's promote, on the
 *  right - the forward verb, and beside it a promote that is not a forward verb (the Jobs index's `Run job`, which
 *  runs the ticked set). An index with neither (Accounts) still draws the toolbar, empty, so the page keeps its
 *  place. What acts on the list is the list's first row (`TableStrip`), never here. */
export function IndexToolbar({ tab, promote }: { readonly tab: Tab; readonly promote?: ToolbarVerb }) {
  const forward = useForwardVerbs(tab);
  return (
    <Toolbar
      right={
        <>
          {promote !== undefined && <PromoteButton verb={promote} />}
          {forward === undefined ? undefined : <ForwardButton verb={forward} />}
        </>
      }
    />
  );
}
