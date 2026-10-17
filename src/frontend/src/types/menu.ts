import type { ReactNode } from 'react'

/** One row of a context menu. A row is an action, a submenu, a separator, or a
 *  heading — never two of those at once. */
export type MenuItem =
  | { kind: 'separator' }
  | { kind: 'heading'; label: string }
  | {
      kind: 'action'
      label: string
      icon?: ReactNode
      /** Present (true OR false) reserves the tick slot, so labels do not
       *  shift as membership toggles. Absent means no tick column at all. */
      checked?: boolean
      danger?: boolean
      disabled?: boolean
      /** Rule 16: a disabled row says WHY, on the control itself. */
      disabledReason?: string
      onSelect: () => void
    }
  | {
      /** A row that opens a panel of its own (doc 03 §Context menu actions,
       *  doc 10 §8.5: `Collections ▸`). A flat list swamps the menu once
       *  there are more than a handful of collections. */
      kind: 'submenu'
      label: string
      icon?: ReactNode
      /** ONE level deep, deliberately. Doc 10 §8.5 asks for `Collections ▸`
       *  and nothing beyond it; a menu that nests further is a navigation
       *  tree wearing a menu's clothes. */
      items: MenuRow[]
    }

/** A row that may appear inside a submenu — everything but another submenu. */
export type MenuRow = Exclude<MenuItem, { kind: 'submenu' }>

/** Where the menu was summoned from, in viewport coordinates. */
export interface MenuAnchor {
  x: number
  y: number
}
