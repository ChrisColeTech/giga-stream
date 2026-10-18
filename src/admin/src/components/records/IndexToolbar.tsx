import { Toolbar } from "@giga/ui/layout/Toolbar";
import { useForwardVerbs } from "@/hooks/useForwardVerbs";
import type { Tab } from "@/types/shell";
import { ForwardButton } from "./ForwardButton";

/** An index's page toolbar (LoRA Trainer `pages/datasets/DatasetsIndex.tsx` 64-70): ONLY the page's forward verb, on the
 *  right. An index with none (Jobs, Accounts) still draws the toolbar, empty, so the page keeps its place. What acts on
 *  the list is the list's first row (`TableStrip`), never here. */
export function IndexToolbar({ tab }: { readonly tab: Tab }) {
  const forward = useForwardVerbs(tab);
  return <Toolbar right={forward === undefined ? undefined : <ForwardButton verb={forward} />} />;
}
