import { TITLEBAR_HEIGHT } from "../lib/child-metrics";

/* THE SCRIM over the main window while a modal child window is open. It washes the whole main window, swallows every
 * press on it (the main window takes no input behind a modal), and a press on it brings the open window forward and
 * gives it the keyboard. The titlebar's slice of the scrim is a drag region, so the window can still be moved and the
 * caption buttons at the right end, which `env(titlebar-area-width)` leaves out, stay uncovered: the app can still be
 * closed or moved aside under every surface. The wash is `--color-scrim`, one value per theme. */
export function ChildScrim({ onPress }: { onPress: () => void }) {
  return (
    <>
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
      <div
        data-scrim-titlebar
        aria-hidden
        className="fixed top-0 left-0 z-48 bg-scrim [-webkit-app-region:drag]"
        style={{ height: TITLEBAR_HEIGHT, width: "env(titlebar-area-width, 100%)" }}
        onPointerDown={(event) => {
          event.preventDefault();
          onPress();
        }}
      />
    </>
  );
}
