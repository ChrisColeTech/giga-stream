/** The space between an anchor and its bubble, and the least the bubble keeps from the viewport's side edges. */
export const TOOLTIP_GAP = 8;
export const TOOLTIP_EDGE = 8;

/** The least the bubble's arrow keeps from the bubble's own corners, so it never rides over a rounded corner. */
export const ARROW_INSET = 12;

/** The anchor's screen box, as `getBoundingClientRect` gives it (only the parts placement reads). */
export interface AnchorBox {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
}

export interface BubbleSize {
  readonly width: number;
  readonly height: number;
}

export interface TooltipPlacement {
  /** The bubble's left and top, in viewport pixels. */
  readonly left: number;
  readonly top: number;
  /** True when there was no room above and the bubble sits under the anchor. */
  readonly below: boolean;
  /** The arrow's centre, in pixels from the bubble's left edge: the anchor's centre, clamped inside the bubble. */
  readonly arrow: number;
}

/** Where a tooltip bubble goes: above its anchor (below when there is no room), centred on it, kept inside the viewport
 *  horizontally. A bubble the viewport pushed sideways still points at its anchor: the arrow follows the anchor's
 *  centre instead of staying at the bubble's middle (`26` section 5), and stays clear of the bubble's corners. */
export function placeTooltip(anchor: AnchorBox, bubble: BubbleSize, viewportWidth: number): TooltipPlacement {
  const below = anchor.top - bubble.height - TOOLTIP_GAP < 4;
  const centre = anchor.left + anchor.width / 2;
  const left = Math.min(Math.max(TOOLTIP_EDGE, centre - bubble.width / 2), viewportWidth - bubble.width - TOOLTIP_EDGE);
  const top = below ? anchor.bottom + TOOLTIP_GAP : anchor.top - bubble.height - TOOLTIP_GAP;
  const low = Math.min(ARROW_INSET, bubble.width / 2);
  const high = Math.max(bubble.width - ARROW_INSET, bubble.width / 2);
  return { left, top, below, arrow: Math.min(Math.max(centre - left, low), high) };
}
