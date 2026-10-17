/* The classes a library card shares (`06` section 4.2, and the visual sweep in `21` section 8a). Every card is a `group/card`,
 * so its lift and its reveals name one group. Tailwind reads these as whole class names, so they are never built up
 * from parts. */

/** The hover lift: 2% over the family's fade duration, linear. Nothing else on the card moves on hover. */
export const CARD_LIFT =
  "transition-[transform,box-shadow] duration-fade ease-linear " +
  "group-hover/card:-translate-y-[2%] group-hover/card:shadow-[var(--shadow-menu)]";

/** The card's actions and menu: hidden until the card is hovered or has keyboard focus within it. */
export const CARD_REVEAL =
  "opacity-0 transition-opacity duration-fade ease-linear " +
  "group-hover/card:opacity-100 group-focus-within/card:opacity-100";

/** A dark fade under the actions, so Play and Info read over any artwork. */
export const CARD_FOOT_FADE =
  "bg-[linear-gradient(to_top,color-mix(in_srgb,var(--color-surface)_92%,transparent),transparent)]";

/** A dark fade over the top of a landscape card, so its title reads over any backdrop. */
export const CARD_HEAD_FADE =
  "bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-surface)_88%,transparent),transparent)]";
