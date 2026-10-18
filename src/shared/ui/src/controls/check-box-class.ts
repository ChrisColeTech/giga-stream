/* The ROW-SELECTION box (`docs/28` section 4.3, Appendix A row 23), shared by a row's tick (`Checkbox`) and the selection
 * toolbar's three-state `All` (`AllCheckbox`), so the two read as one control. 20px, the Toggle's and the fields' tokens:
 * the recessed surface and its edge off, the accent edge and fill with the ink-coloured check on (`data-on`). */
export const CHECK_BOX =
  "grid size-5 flex-none cursor-pointer place-items-center rounded-ctl border border-ctl-edge bg-surface p-0 " +
  "text-accent-ink transition-[background,border-color,box-shadow] duration-fade ease-linear hover:border-dim " +
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent-tint)] " +
  "disabled:cursor-not-allowed disabled:opacity-45 " +
  "data-on:border-accent data-on:bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent))] " +
  "data-on:shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)]";
