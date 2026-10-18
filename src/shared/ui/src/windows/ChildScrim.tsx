import { TITLEBAR_HEIGHT } from "../lib/child-metrics";

/* THE SCRIM over the main window while a modal child window is open. One wash, starting at the titlebar's height: the
 * titlebar keeps its native drag and its sleeping controls stay visibly asleep behind it (`50` section 2.5), while the
 * caption buttons at the right end, which `env(titlebar-area-width)` leaves out, stay uncovered, so the app can still
 * be closed or moved aside under every surface. The wash swallows every press on the main window (it takes no input
 * behind a modal), and a press on it brings the open window forward and gives it the keyboard. It is `--color-scrim`,
 * one value per theme. */
export function ChildScrim({ onPress }: { onPress: () => void }) {
  return (
    <div
      data-scrim
      aria-hidden
      className="fixed right-0 bottom-0 left-0 z-48 bg-scrim"
      style={{ top: TITLEBAR_HEIGHT }}
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
    />
  );
}
