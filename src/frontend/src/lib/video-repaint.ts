/** The least of an element this needs: a test passes a plain object, the page passes an `HTMLElement`. */
export interface Repaintable {
  readonly style: { display: string };
  readonly offsetHeight: number;
}

/** Forces an element to lay out again: hides it, reads its height (which makes the engine lay it out), puts back the
 *  inline `display` it had, and reads again. A video painted while its container was narrower is not repainted when
 *  the container grows; this is what makes the engine do it. Only inline `display` is touched (never `src`,
 *  `currentTime` or `paused`), so a playing stream keeps playing. Never throws: a detached element may refuse a read. */
export function repaintElement(element: Repaintable): void {
  let previous: string;
  try {
    previous = element.style.display;
  } catch {
    return;
  }
  try {
    element.style.display = "none";
    void element.offsetHeight;
  } catch {
    /* The element went away mid-way; the restore below is still attempted. */
  }
  try {
    element.style.display = previous;
    void element.offsetHeight;
  } catch {
    /* Nothing is left to repaint. */
  }
}
