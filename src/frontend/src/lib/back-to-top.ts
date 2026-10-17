/** Whether the Back to top button shows: once the list is scrolled past about one viewport. A scroller not yet laid out
 *  (no height) never shows it, and at the top it is simply absent. */
export function backToTopVisible(scrollTop: number, viewportHeight: number): boolean {
  return viewportHeight > 0 && scrollTop > viewportHeight;
}

/** The scroll behaviour of the jump: smooth, or instant under reduced motion. */
export function backToTopBehavior(reduceMotion: boolean): "auto" | "smooth" {
  return reduceMotion ? "auto" : "smooth";
}
