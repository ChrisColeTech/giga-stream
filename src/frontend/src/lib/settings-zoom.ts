import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/constants/settings-sections";

export type ZoomDirection = 1 | -1;

/** The zoom one step away from `value`, kept to one decimal and held inside 0.5 to 3. */
export function stepZoom(value: number, direction: ZoomDirection): number {
  const next = Math.round((value + direction * ZOOM_STEP) * 10) / 10;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
}

/** Whether a step in `direction` moves the zoom at all; at either end the step is disabled. */
export function canStepZoom(value: number, direction: ZoomDirection): boolean {
  return stepZoom(value, direction) !== value;
}

/** The zoom as the stepper shows it: always one decimal, so 1 reads `1.0`. */
export function formatZoom(value: number): string {
  return value.toFixed(1);
}
