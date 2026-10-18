/** The slice of a pointer or click event the catcher uses (a React event satisfies it). */
export interface CatcherPress {
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** A press on the catcher (`06` section 4.6): it goes no further (nothing under it is activated), and it closes the
 *  search unless Title information stands over it (`paused`), exactly Escape's rule. */
export function pressCatcher(event: CatcherPress, paused: () => boolean, close: () => void): void {
  event.preventDefault();
  event.stopPropagation();
  if (!paused()) close();
}

/** The click that follows the press is swallowed too, so no card under it is activated. */
export function swallowClick(event: CatcherPress): void {
  event.preventDefault();
  event.stopPropagation();
}

export interface SpotlightCatcherProps {
  readonly paused: () => boolean;
  readonly onClose: () => void;
}

/** The catcher is the spotlight's backdrop (`50` section 2.6): the family's `bg-scrim` at z-46, the same
 *  `--color-scrim` as the child scrim, under the panel (z-47); the child scrim (z-48) still washes over both. A press
 *  on it dismisses the search. It is still not a modal: no dialog semantics, nothing beneath is reached. */
export function SpotlightCatcher({ paused, onClose }: SpotlightCatcherProps) {
  return (
    <div
      aria-hidden
      data-spotlight-catcher
      className="fixed inset-0 z-46 bg-scrim"
      onPointerDown={(event) => pressCatcher(event, paused, onClose)}
      onClick={swallowClick}
    />
  );
}
