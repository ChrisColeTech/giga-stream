import { IconButton } from "@giga/ui/controls/IconButton";
import { FORWARD_ICONS, FORWARD_TOOLTIPS } from "@/constants/toolbar-icons";
import type { ToolbarAction } from "@/lib/workspace-verbs";

/** `Preview channel`: the workspace's one cross-tab verb, an icon at the end of the Status group's first row (there is
 *  no page toolbar). Disabled with `Save the channel first` while the draft differs from the saved channel. */
export function PreviewButton({ preview }: { readonly preview: ToolbarAction }) {
  const Glyph = FORWARD_ICONS.Preview;
  return (
    <IconButton
      aria-label={FORWARD_TOOLTIPS.Preview}
      title={FORWARD_TOOLTIPS.Preview}
      reason={preview.reason}
      onClick={preview.onPress}
    >
      <Glyph className="size-3.5" aria-hidden />
    </IconButton>
  );
}
