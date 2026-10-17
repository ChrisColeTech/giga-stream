/** Exported for the rare control that is a slider ALONE — a density/zoom-like
 *  value where the number is noise (gallery thumbnail size). A parameter row
 *  keeps the full `SliderField`: label + track + typeable readout (rule 19).
 *
 *  Its own file (docs/27 step 2b): a `.tsx` file holds one component, and a constant
 *  named like one would read as a second export. */
export const RANGE =
  'h-ctl-sm min-w-0 flex-1 cursor-pointer appearance-none bg-transparent outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-45 ' +
  '[&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full ' +
  '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,var(--color-accent)_var(--fill),var(--color-ctl)_var(--fill))] ' +
  '[&::-webkit-slider-thumb]:-mt-[4px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ctl-edge ' +
  '[&::-webkit-slider-thumb]:bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] ' +
  '[&::-webkit-slider-thumb]:shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] ' +
  'focus-visible:[&::-webkit-slider-thumb]:border-accent ' +
  '[&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-ctl ' +
  '[&::-moz-range-progress]:h-[3px] [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-accent ' +
  '[&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full ' +
  '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ctl-edge [&::-moz-range-thumb]:bg-ctl'
