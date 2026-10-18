import type { LucideIcon } from "lucide-react";
import { IconButton } from "../controls/IconButton";

export interface ToolbarVerb {
  readonly id: string;
  /** The verb: the button's `aria-label` and its tooltip. */
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onPress: () => void;
  /** Why the verb cannot be used now; the verb stays in place, natively disabled, with this in its focusable tooltip. */
  readonly reason?: string;
}

export interface ToolbarStripProps {
  /** The strip's accessible name. */
  readonly label: string;
  /** Right-aligned, in order. An empty list still draws the strip, so the page below does not move between pages. */
  readonly verbs: readonly ToolbarVerb[];
}

/** THE PAGE TOOLBAR: 40px on the panel under the titlebar, at its right edge the page's own verbs (`28` section 4.3): the
 *  forward arrows to the next tab and nothing that acts on a table (those are the table strip's). Icon buttons only
 *  (`01` section 9), each with an `aria-label` and a tooltip; no text button, no fill, no edge. */
export function ToolbarStrip({ label, verbs }: ToolbarStripProps) {
  return (
    <div role="toolbar" aria-label={label} className="flex h-10 flex-none items-center justify-end gap-1 border-b border-border bg-panel px-3">
      {verbs.map((verb) => {
        const Glyph = verb.icon;
        return (
          <IconButton key={verb.id} aria-label={verb.label} title={verb.label} reason={verb.reason} onClick={verb.onPress}>
            <Glyph aria-hidden />
          </IconButton>
        );
      })}
    </div>
  );
}
