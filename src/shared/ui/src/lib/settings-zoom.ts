/** The UI zoom's range and step (`03` section 3.2, `06` section 6.2): 0.5 to 3, in tenths. */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

export type ZoomDirection = 1 | -1;

/** A zoom held inside the range. */
export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

/** The zoom one step away from `value`, kept to one decimal and held inside 0.5 to 3. */
export function stepZoom(value: number, direction: ZoomDirection): number {
  return clampZoom(Math.round((value + direction * ZOOM_STEP) * 10) / 10);
}

/** Whether a step in `direction` moves the zoom at all; at either end the step is disabled. */
export function canStepZoom(value: number, direction: ZoomDirection): boolean {
  return stepZoom(value, direction) !== value;
}

/** The zoom as the stepper shows it: always one decimal, so 1 reads `1.0`. */
export function formatZoom(value: number): string {
  return value.toFixed(1);
}
