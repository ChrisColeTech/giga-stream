import { IconButton } from "@giga/ui/controls/IconButton";
import { PREVIEW_ICON, FORWARD_TOOLTIPS } from "@/constants/toolbar-icons";
import type { ToolbarAction } from "@/lib/workspace-verbs";

/** `Preview channel`: the workspace's one cross-tab verb, a trailing icon at the end of the Status group's first row
 *  (LoRA Trainer's row grammar: trailing icon buttons on the readout edge; the glyph is its `View`, `Eye`). Disabled with
 *  `Save the channel first` while the draft differs from the saved channel. */
export function PreviewButton({ preview }: { readonly preview: ToolbarAction }) {
  const Glyph = PREVIEW_ICON;
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
