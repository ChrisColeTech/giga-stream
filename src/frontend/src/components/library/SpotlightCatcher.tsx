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

/** An invisible full-window click-catcher just below the spotlight window and above the app: no fill, no tint, no blur,
 *  nothing drawn (the Library stays at full brightness; this is not a scrim). A press on it dismisses the search. */
export function SpotlightCatcher({ paused, onClose }: SpotlightCatcherProps) {
  return (
    <div
      aria-hidden
      data-spotlight-catcher
      className="fixed inset-0 z-46"
      onPointerDown={(event) => pressCatcher(event, paused, onClose)}
      onClick={swallowClick}
    />
  );
}
