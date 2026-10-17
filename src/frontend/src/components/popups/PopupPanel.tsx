import { PopupPanel as SharedPopupPanel } from "@giga/ui/windows/PopupPanel";
import type { PopupPanelProps } from "@/types/overlays";

/** THE ONE POPUP SCAFFOLD is the family UI library's (docs/27 step 7): this keeps the interface's path to it, so a
 *  feature's popup imports it from here as it always did. */
export function PopupPanel(props: PopupPanelProps) {
  return <SharedPopupPanel {...props} />;
}
