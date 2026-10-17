import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Accent } from '../form/form-classes'

/* The action list's data shapes (docs/27 step 2c: the component file holds one component, so its types live here). */

export interface ActionItem {
  id: string
  title: string
  description?: string
  icon?: ReactNode
  /** The left-edge bar: what state the row is in (the ramp lives in form/form-classes.ts so a settings Row draws the same bar — §20.5). */
  accent?: Accent
  /** Shown on hover: buttons the row offers. */
  actions?: ReactNode
  trailing?: ReactNode
  disabled?: boolean
  title_attr?: string
  onClick?: () => void
}

export interface ActionListToolbar {
  tabs?: ReadonlyArray<{ value: string; label: string }>
  activeTab?: string
  onTabChange?: (value: string) => void
  searchValue?: string
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  filterValue?: string
  filterOptions?: ReadonlyArray<{ value: string; label: string }>
  onFilterChange?: (value: string) => void
  onRefresh?: () => void
  onAdd?: () => void
  addLabel?: string
}

export interface ActionListProps {
  title?: string
  icon?: LucideIcon
  items: ActionItem[]
  toolbar?: ActionListToolbar
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Skeleton rows drawn while `items` is empty (loading or none — doc 03 §Loading and Empty). */
  skeleton?: number
  size?: 'sm' | 'default' | 'lg'
  className?: string
}
