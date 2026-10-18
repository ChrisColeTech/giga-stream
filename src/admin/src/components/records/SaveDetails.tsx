import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import type { SaveVerb } from "@/lib/workspace-verbs";

export const SAVE_DETAILS = "Save details";

/** The form's one commit (`01` section 9, Forms): `Save details`, the only primary on the workspace, ending the final
 *  editable group exactly as the Collections window's Details group does. Disabled with its reason (`Nothing has
 *  changed.`, a refused value, a call going) as a tooltip. */
export function SaveDetails({ save }: { readonly save: SaveVerb }) {
  return (
    <Actions>
      <Button variant="primary" reason={save.reason} onClick={save.onPress}>
        {SAVE_DETAILS}
      </Button>
    </Actions>
  );
}
