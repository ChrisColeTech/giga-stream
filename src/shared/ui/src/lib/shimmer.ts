/* THE SHIMMER (docs/27 step 2c): one sweep, one animation, one gradient. Two shapes wear it, and they differ only in
 * their box: a bar is a line-height block, a tile fill shapes to the box it sits in. Both are built from SWEEP, so the
 * look cannot drift between a row's bars and a card's tile. */
const SWEEP =
  'bg-[length:200%_100%] animate-skel-shimmer bg-[linear-gradient(100deg,var(--color-hair)_30%,var(--color-border)_50%,var(--color-hair)_70%)]'

/** The shimmer block itself. Exported because the real queue row wears it too:
 *  a thumbnail slot with a picture on the way is a shimmer, and a slot with no
 *  picture is a glyph — two different facts that must not render the same
 *  (doc 03 §Loading and Empty). One definition, so the skeleton and the row it
 *  stands in for cannot drift apart. */
export const SHIMMER = `block h-[9px] rounded-ctl ${SWEEP}`

/** The tile fill: the same sweep with no height of its own, so it takes the size of the box it sits in. */
export const SHIMMER_TILE = `block ${SWEEP}`
