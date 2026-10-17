import * as Menu from '@radix-ui/react-dropdown-menu'
import { useRef } from 'react'

import type { MenuAnchor, MenuItem } from '@/types/menu'
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
            if (opener.current instanceof HTMLElement) opener.current.focus()
          }}
        >
          {items.map((item, index) =>
            item.kind === 'submenu' ? <ContextMenuSubmenu key={index} row={item} /> : <ContextMenuRow key={index} row={item} hasTicks={hasTicks} />,
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
