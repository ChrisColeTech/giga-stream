import * as Menu from '@radix-ui/react-dropdown-menu'
import { useEffect, useRef } from 'react'

import type { MenuAnchor, MenuItem } from './types'
import { ContextMenuRow, MENU_PANEL } from './ContextMenuRow'
import { ContextMenuSubmenu } from './ContextMenuSubmenu'

/* Actions that could be right-click items must not consume a layout row — a
 * card's actions live here, not in a toolbar (doc 10 §8.5).
 *
 * Built on RADIX's menu (owner, 2026-08-06). Plan §0.0.4 called for Headless
 * UI, and its `Menu` carries everything this needs EXCEPT the one thing doc 03
 * and doc 10 §8.5 both require: a submenu. Headless UI 2.2 has no nested menu,
 * and every way of faking one runs into the same wall — a `MenuItem` closes its
 * menu when it is activated, which is right for every other row and exactly
 * wrong for the row that opens a panel. Radix ships `Menu.Sub` properly, so the
 * menu uses Radix and the dialog and the settings tabs stay on Headless UI.
 *
 * Roving focus, `aria-activedescendant`, typeahead, Escape, outside-click,
 * portal layering, collision flipping and return-focus are the library's job.
 * What stays ours is the skin — every token, radius, shadow and duration still
 * comes from `@theme`.
 *
 * A context menu has no trigger button: it is summoned AT THE POINTER. So the
 * trigger is a zero-size anchor pinned at those coordinates, and the menu is
 * opened controlled, which is also how closing reports back to the shell. */

export interface ContextMenuProps {
  anchor: MenuAnchor
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ anchor, items, onClose }: ContextMenuProps) {
  const hasTicks = items.some((item) => item.kind === 'action' && item.checked !== undefined)
  /* Radix returns focus to ITS trigger, which is the invisible stub below; the
     card or row the menu was summoned from is where a keyboard user actually
     was, so that is what gets focus back. */
  const opener = useRef(typeof document === 'undefined' ? null : document.activeElement)
  /* A chosen row's action runs AFTER the menu has closed and given focus back. Run inside Radix's select, a row that
     opens a window (Rename… opens Collections) has its window's focus pulled back by the menu's focus trap, and the
     window is then deaf to its own Escape. */
  const pending = useRef<(() => void) | null>(null)
  const flush = (): void => {
    const action = pending.current
    pending.current = null
    action?.()
  }
  /* Should the menu unmount before Radix reports the close, the chosen action still runs. */
  useEffect(() => {
    const queue = pending
    const from = opener.current
    return () => {
      const action = queue.current
      queue.current = null
      if (action === null) return
      /* Focus is on the opener first, so a window the action opens returns focus there when it closes. */
      if (from instanceof HTMLElement) from.focus()
      action()
    }
  }, [])

  return (
    <Menu.Root
      open
      /* Escape, an outside click and a selected row all arrive here, so the
         shell learns the menu is gone without owning any of that itself. */
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Menu.Trigger
        aria-label="Actions"
        tabIndex={-1}
        className="fixed size-0 overflow-hidden border-0 bg-transparent p-0"
        style={{ left: anchor.x, top: anchor.y }}
      />
      <Menu.Portal>
        <Menu.Content
          align="start"
          side="bottom"
          sideOffset={0}
          collisionPadding={8}
          className={MENU_PANEL}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            /* Radix reports this on a timer after the menu unmounts, by when a deferred action may already have opened
               a window and focused its frame: focus goes back to the opener only if nothing has claimed it. */
            const active = document.activeElement
            const claimed = active !== null && active !== document.body && active.closest('[role="menu"]') === null
            if (!claimed && opener.current instanceof HTMLElement) opener.current.focus()
            flush()
          }}
        >
          {items.map((item, index) =>
            item.kind === 'submenu' ? (
              <ContextMenuSubmenu key={index} row={item} />
            ) : (
              <ContextMenuRow key={index} row={item} hasTicks={hasTicks} onRun={(action) => (pending.current = action)} />
            ),
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
