/* The family rail link used by NavItem and SettingsRail, plus NavGroup's legacy heading class. Kept outside the
 * components because a `.tsx` file holds one component (docs/27 step 2c). */

export const NAV_ROW =
  'flex h-8.5 w-full cursor-pointer items-center gap-3 border-0 border-l-2 border-l-transparent ' +
  'bg-transparent pr-2.5 pl-3 text-left font-sans text-[13px] text-muted ' +
  'transition-[background,border-color,color] duration-fade ease-linear ' +
  'hover:bg-hov hover:text-text active:bg-hov active:text-faint focus-visible:outline-none ' +
  'data-selected:border-l-accent data-selected:bg-ctl data-selected:text-accent-text ' +
  'data-selected:[&_svg]:text-accent disabled:cursor-default disabled:opacity-40'

/** A group heading in the rail: Caption 12, sentence case. */
export const NAV_HEADING = 'px-3 pt-3 pb-1 text-xs leading-4 text-dim'
