import { DUR_FADE_MS } from "@/constants/motion";

/** How long the pointer rests on a card's Details glyph before its popover opens, and so before the detail read starts.
 *  The family tooltip (`components/ui/Tooltip`) has no delay of its own: it shows at once and fades in over
 *  `DUR_FADE_MS`, so that is the family's one hover timing and the one reused here. A fly-over shorter than this
 *  opens nothing and reads nothing. */
export const DETAILS_OPEN_DELAY_MS = DUR_FADE_MS;

/** How long the popover stays after the pointer (and focus) leave, so the pointer can travel from the glyph onto the
 *  popover across the gap between them without it closing. */
export const DETAILS_CLOSE_GRACE_MS = 120;
