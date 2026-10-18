/* THE PILL VOCABULARY, one definition for the two controls that wear it (`Segmented`, one-of; `ChipGroup`, any-of): flat
 * rounded-full pills with no track. Off = hairline edge, muted text; on = the accent tint and edge the buttons use for
 * `data-on`. `equal` sizes every chip to the widest so a row never re-flows; the field size spans a form row at 36px. */
export const PILL_ROW = "inline-flex flex-none flex-wrap items-center gap-1.5";
export const PILL_EQUAL_ROW = "inline-grid auto-cols-fr grid-flow-col gap-1.5";
/** The field size spans the row: equal segments that take the row's full width. */
export const PILL_FIELD_ROW = "grid w-full min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1.5";
export const PILL_FIELD_CHIP = "h-9 px-3 text-sm";

export const PILL_CHIP =
  "inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.25 rounded-full border border-ctl-edge " +
  "bg-transparent whitespace-nowrap text-muted transition-[background,color,border-color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-text " +
  "data-active:border-accent-edge data-active:bg-accent-tint data-active:font-semibold data-active:text-accent-text " +
  "disabled:cursor-not-allowed disabled:text-dim disabled:hover:bg-transparent disabled:hover:text-dim";
