import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { useDetailsPopover } from "@/hooks/useDetailsPopover";
import type { ResolvedItem } from "@/lib/library-marks";
import { DetailsPopover } from "./DetailsPopover";
import { TILE_GLYPH } from "./tile-chrome";

export interface DetailsGlyphProps {
  readonly item: ResolvedItem;
}

/** The Details glyph in the art's top right corner (`06` section 4.2): a button of its own beside the art button, never
 *  inside it, that opens the title's details popover. It never selects the card, opens Title information or starts Play. */
export function DetailsGlyph({ item }: DetailsGlyphProps) {
  const { open, glyph, toggle, close, belongs, keepPress, keepKeys } = useDetailsPopover();
  return (
    <div className="absolute top-1 right-1" onClick={keepPress} onContextMenu={keepPress} onKeyDown={keepKeys}>
      <Tooltip text="Details">
        <button
          ref={glyph}
          type="button"
          className={TILE_GLYPH}
          aria-label={`Details for ${item.title}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </Tooltip>
      {open && glyph.current !== null && (
        <DetailsPopover item={item} anchor={glyph.current} onClose={close} belongs={belongs} />
      )}
    </div>
  );
}
