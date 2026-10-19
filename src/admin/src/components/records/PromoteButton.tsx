import { Button } from "@giga/ui/controls/Button";
import type { ToolbarVerb } from "@/lib/workspace-verbs";

/** The page's promote whose label is not a forward verb (`Run job`, `55` decisions 1, 2 and 6): the forward verb's
 *  look - the small primary, the word alone, no icon - with its own tooltip at rest, disabled with its reason. */
export function PromoteButton({ verb }: { readonly verb: ToolbarVerb }) {
  return (
    <Button size="sm" variant="primary" title={verb.tip} reason={verb.reason} onClick={verb.onPress}>
      {verb.label}
    </Button>
  );
}
