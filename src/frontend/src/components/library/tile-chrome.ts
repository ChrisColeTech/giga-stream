/* The library's tile chrome, copied from LoRA Studio's gallery tile (components/media/MediaGrid.tsx `Tile`): the art is
 * one bordered button, the accent border and ring when selected, the dim border on hover; corner badges sit on it, and the
 * card's verbs are a row of equal bordered buttons under it. Giga Stream's art is a 2:3 poster or a 16:9 backdrop, not
 * LoRA's square (docs/23 section 4, wave 3). */

/** The art button's frame, without its aspect. */
export const TILE_FRAME =
  "relative w-full cursor-pointer overflow-hidden rounded-card border bg-surface p-0 " +
  "transition-[border-color,box-shadow] duration-fade ease-linear";

export const TILE_SELECTED = "border-accent shadow-[0_0_0_2px_var(--color-accent-tint)]";
export const TILE_IDLE = "border-border hover:border-dim";

const TILE_SCRIM = "bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]";

const TILE_BOX = `grid size-5 place-items-center rounded-ctl ${TILE_SCRIM}`;

/** A badge in a corner of the art, on the tile's scrim. */
export const TILE_BADGE = `absolute ${TILE_BOX}`;

/** The rating chip: the same scrim as a badge, as wide as its star and one-decimal figure. */
export const TILE_CHIP =
  `absolute inline-flex h-5 items-center gap-1 rounded-ctl px-1.5 font-mono text-xs text-text ${TILE_SCRIM} [&_svg]:size-3`;

/** The Details glyph: a badge that is a button (placed by the wrapper it sits in), dim until hovered or focused. */
export const TILE_GLYPH =
  `${TILE_BOX} cursor-pointer border-0 p-0 text-muted transition-[color,box-shadow] duration-fade ease-linear ` +
  "hover:text-text focus-visible:text-text focus-visible:outline-none " +
  "focus-visible:shadow-[0_0_0_2px_var(--color-accent-tint)]";

/** One of the verbs under the art: MediaGrid's `BTN`, made ghost (`01` §9 Buttons and surfaces: no edge in the body). */
export const TILE_BUTTON =
  "inline-flex h-6 flex-1 cursor-pointer items-center justify-center gap-1 rounded-ctl border border-transparent " +
  "bg-transparent font-sans text-xs text-muted hover:bg-hov hover:text-text disabled:cursor-default " +
  "disabled:opacity-40 [&_svg]:size-3";
