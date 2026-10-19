import { Button } from "@giga/ui/controls/Button";
import type { ToolbarVerb } from "@/lib/workspace-verbs";

/** The page's operation on the current record or ticked set: a small primary word with no icon or navigation arrow. */
export function PromoteButton({ verb }: { readonly verb: ToolbarVerb }) {
  return (
    <Button size="sm" variant="primary" title={verb.tip} reason={verb.reason} onClick={verb.onPress}>
      {verb.label}
    </Button>
  );
}
