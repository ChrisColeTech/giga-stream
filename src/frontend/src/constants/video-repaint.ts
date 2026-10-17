/** The centre pane must change width by MORE than this many pixels before the surface's videos are repainted: sub-pixel
 *  and rounding jitter from the layout engine is not a resize. */
export const VIDEO_REPAINT_WIDTH_TOLERANCE_PX = 1;

/** The element the repaint walks: every video in the workspace, so one mounted later or replaced is covered. */
export const VIDEO_REPAINT_SELECTOR = "video";

/** The pane whose width drives the repaint; the workspace box is the fallback if a surface lacks one. */
export const VIDEO_REPAINT_PANE_SELECTOR = ".pane-center";
