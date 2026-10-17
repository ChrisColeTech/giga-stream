import { Info } from "lucide-react";
import { useDetailsPopover } from "@/hooks/useDetailsPopover";
import type { ResolvedItem } from "@/lib/library-marks";
import { DetailsPopover } from "./DetailsPopover";
import { TILE_GLYPH } from "./tile-chrome";

export interface DetailsGlyphProps {
  readonly item: ResolvedItem;
}

/** The Details glyph in the art's top right corner (`06` section 4.2): a button of its own beside the art button, never
 *  inside it. Hovering it or focusing it by keyboard shows the title's details popover like a tooltip. A press never
 *  selects the card, opens Title information or starts Play; on a device that cannot hover it toggles the popover. */
export function DetailsGlyph({ item }: DetailsGlyphProps) {
  const popover = useDetailsPopover();
  const { open, glyph } = popover;
  return (
    <div
      className="absolute top-1 right-1"
      onPointerEnter={popover.onPointerEnter}
      onPointerLeave={popover.onPointerLeave}
      onFocus={popover.onFocus}
      onBlur={popover.onBlur}
      onClick={popover.keepPress}
      onContextMenu={popover.keepPress}
      onKeyDown={popover.keepKeys}
    >
      <button
        ref={glyph}
        type="button"
        className={TILE_GLYPH}
        aria-label={`Details for ${item.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={popover.onPress}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open && glyph.current !== null && (
        <DetailsPopover item={item} anchor={glyph.current} onClose={popover.close} belongs={popover.belongs} />
      )}
    </div>
  );
}
