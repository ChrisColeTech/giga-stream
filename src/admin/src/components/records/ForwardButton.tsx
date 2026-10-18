import { Button } from "@giga/ui/controls/Button";
import { FORWARD_ARROW, FORWARD_TOOLTIPS } from "@/constants/toolbar-icons";
import type { ToolbarAction } from "@/lib/workspace-verbs";

/** The page's ONE forward verb, rightmost in its page toolbar (LoRA Trainer `pages/datasets/DatasetsIndex.tsx` 66-68):
 *  the small primary, the destination's word and `→`, a tooltip saying what it does, disabled with its reason. */
export function ForwardButton({ verb }: { readonly verb: ToolbarAction }) {
  return (
    <Button size="sm" variant="primary" title={FORWARD_TOOLTIPS[verb.label]} reason={verb.reason} onClick={verb.onPress}>
      {`${verb.label} ${FORWARD_ARROW}`}
    </Button>
  );
}
