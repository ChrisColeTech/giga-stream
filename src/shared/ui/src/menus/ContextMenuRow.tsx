import * as Menu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'

import type { MenuRow } from './types'

/* One row of a context menu, and the class vocabulary every panel shares.
 *
 * Radix owns the row's ARIA, its roving focus and its typeahead; every colour,
 * radius, shadow and duration below still comes from the tokens (doc 10 §11),
 * so adopting the primitive changed the behaviour and not the skin.
 * `data-highlighted` is Radix's keyboard-or-pointer focus flag. */

/** The panel's own box, shared by the menu and its submenus. The drop shadow
 *  is the ONE real shadow in the app (doc 10 §11.3) and it is a token, so the
 *  colour lives in `index.css` where hard rule 8 requires it. */
export const MENU_PANEL_SKIN =
  'z-70 rounded-card border border-border bg-panel p-1 shadow-[var(--shadow-menu)] animate-menu-in focus:outline-none'

export const MENU_PANEL = `min-w-[190px] ${MENU_PANEL_SKIN}`

export const MENU_ROW =
  'flex w-full cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-2 py-1.5 ' +
  'text-left font-sans text-[13px] text-muted transition-colors duration-fade ease-linear outline-none ' +
  'select-none data-highlighted:bg-hov data-highlighted:text-text active:bg-hov active:text-faint ' +
  'data-disabled:pointer-events-none data-disabled:cursor-default data-disabled:opacity-40 ' +
  '[&_svg]:size-3.5 [&_svg]:flex-none ' +
  /* A variant, so it beats the base `text-muted`: an appended colour class
     shares a layer with the one it means to replace and loses on order. */
  'data-danger:text-st-failed'

export interface ContextMenuRowProps {
  row: MenuRow
  /** Reserved for the whole panel whenever ANY of its rows is checkable, so
   *  labels do not shift as membership toggles under the pointer. */
  hasTicks: boolean
  /** Defers the row's action until the menu has closed (`ContextMenu`); absent, it runs at once. */
  onRun?: (action: () => void) => void
}

export function ContextMenuRow({ row, hasTicks, onRun }: ContextMenuRowProps) {
  if (row.kind === 'separator') {
    return <Menu.Separator className="mx-0.5 my-1 h-px bg-hair" />
  }
  if (row.kind === 'heading') {
    return (
      /* Sentence case, no transform (owner, 2026-08-06, per Fluent). */
      <Menu.Label className="px-2 pt-1.25 pb-0.75 font-mono text-[10px] text-dim">{row.label}</Menu.Label>
    )
  }
  return (
    <Menu.Item
      disabled={row.disabled}
      /* Rule 16: a disabled row stays visible and says why. */
      title={row.disabled ? row.disabledReason : undefined}
      data-danger={row.danger === true ? '' : undefined}
      className={MENU_ROW}
      /* Radix closes the menu on select, which is what every row here wants. */
      onSelect={() => (onRun === undefined ? row.onSelect() : onRun(row.onSelect))}
    >
      {hasTicks ? (
        <span className="grid size-3.5 flex-none place-items-center">{row.checked === true && <Check className="text-accent-text" />}</span>
      ) : (
        row.icon
      )}
      <span>{row.label}</span>
    </Menu.Item>
  )
}
