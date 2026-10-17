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

/** A badge in a corner of the art, on the tile's scrim. */
export const TILE_BADGE =
  "absolute grid size-5 place-items-center rounded-ctl bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]";

/** One of the verbs under the art: MediaGrid's `BTN`, verbatim. */
export const TILE_BUTTON =
  "inline-flex h-6 flex-1 cursor-pointer items-center justify-center gap-1 rounded-ctl border border-ctl-edge " +
  "bg-transparent font-sans text-xs text-muted hover:bg-hov hover:text-text disabled:cursor-default " +
  "disabled:opacity-40 [&_svg]:size-3";
