import { Toolbar } from "@giga/ui/layout/Toolbar";
import type { ToolbarVerb } from "@/lib/workspace-verbs";
import { PromoteButton } from "./PromoteButton";

/** An index page toolbar: only its operation on the current ticked set, on the right. Accounts still draws the empty
 *  toolbar so every index starts in the same place. List actions stay in the table strip. */
export function IndexToolbar({ promote }: { readonly promote?: ToolbarVerb }) {
  return <Toolbar right={promote === undefined ? undefined : <PromoteButton verb={promote} />} />;
}
