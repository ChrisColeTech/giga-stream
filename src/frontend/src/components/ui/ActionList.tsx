import { Plus, RefreshCw, Search, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '@giga/ui/controls/IconButton'
import { Input } from '@giga/ui/controls/Input'
import { Select } from '@giga/ui/controls/Select'
import { ACCENT, type Accent } from '@giga/ui/form/form-classes'
import { Segmented } from '@giga/ui/controls/Segmented'
import { SHIMMER } from '@/components/ui/SkeletonRows'
import { cn } from '@giga/ui/lib/cn'

/* THE ACTION LIST (nano-gpt-proxy `action-list.tsx`, ported to the family
 * tokens; doc 06 §2.2 "the models list in the action-list shape"): a header
 * row (icon tile, title or tabs, a filter, a search, refresh / add), then
 * rows — an accent bar on the left edge, an icon tile, a title, a
 * description, actions that appear on hover, a trailing glyph. One row can
 * be selected. No frame — it sits on the open stage; the rows scroll (max 480px); an empty list is
 * skeleton rows of the same shape, never a sentence (doc 03 §Loading and Empty). */
export interface ActionItem {
  id: string
  title: string
  description?: string
  icon?: ReactNode
  /** The left-edge bar: what state the row is in (the ramp lives in Form.tsx so a settings Row draws the same bar — §20.5). */
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

const SIZE = { sm: 'px-3 py-2', default: 'px-4 py-2.5', lg: 'px-5 py-3' } as const

export function ActionList({ title, icon: Icon, items, toolbar, selectedId = null, onSelect, skeleton = 6, size = 'default', className }: ActionListProps) {
  const hasHeader = title !== undefined || toolbar !== undefined
  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      {hasHeader && (
        <div className="flex flex-none items-center gap-3 pb-3">
          {Icon !== undefined && (
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-[linear-gradient(135deg,var(--color-accent-tint),transparent)] text-accent-text">
              <Icon className="size-5" aria-hidden />
            </span>
          )}
          {toolbar?.tabs !== undefined ? (
            <Segmented<string>
              aria-label={title ?? 'View'}
              options={toolbar.tabs.map((t) => ({ value: t.value, label: t.label }))}
              value={toolbar.activeTab ?? toolbar.tabs[0]?.value ?? ''}
              onChange={(v) => toolbar.onTabChange?.(v)}
            />
          ) : (
            title !== undefined && <span className="text-sm font-semibold text-text">{title}</span>
          )}
          {toolbar !== undefined && (
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
              {toolbar.onFilterChange !== undefined && toolbar.filterOptions !== undefined && (
                <span className="w-[200px] flex-none">
                  <Select
                    value={toolbar.filterValue ?? 'all'}
                    aria-label="Filter"
                    className="h-9! text-sm!"
                    onChange={(e) => toolbar.onFilterChange?.(e.target.value)}
                  >
                    {toolbar.filterOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </span>
              )}
              {toolbar.onSearchChange !== undefined && (
                <span className="relative min-w-[160px] flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim" aria-hidden />
                  <Input
                    value={toolbar.searchValue ?? ''}
                    placeholder={toolbar.searchPlaceholder ?? 'Search'}
                    aria-label={toolbar.searchPlaceholder ?? 'Search'}
                    className="h-9! pl-9! text-sm!"
                    onChange={(e) => toolbar.onSearchChange?.(e.target.value)}
                  />
                </span>
              )}
              {toolbar.onRefresh !== undefined && (
                <IconButton bordered title="Refresh" aria-label="Refresh" className="size-9" onClick={toolbar.onRefresh}>
                  <RefreshCw className="size-4" />
                </IconButton>
              )}
              {toolbar.onAdd !== undefined && (
                <IconButton bordered title={toolbar.addLabel ?? 'Add'} aria-label={toolbar.addLabel ?? 'Add'} className="size-9" onClick={toolbar.onAdd}>
                  <Plus className="size-4" />
                </IconButton>
              )}
            </div>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <div className="pointer-events-none divide-y divide-hair" aria-hidden>
          {Array.from({ length: skeleton }, (_, i) => (
            <div key={i} className={cn('flex items-center gap-3 pl-2', SIZE[size])}>
              <span className="size-9 flex-none rounded-lg bg-ctl/60" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
                <span className="text-sm before:content-['\\200b']">
                  <span className={cn(SHIMMER, 'h-[9px] rounded-ctl')} style={{ width: `${40 + ((i * 29) % 35)}%` }} />
                </span>
                <span className="text-xs before:content-['\\200b']">
                  <span className={cn(SHIMMER, 'h-2 rounded-ctl')} style={{ width: `${25 + ((i * 17) % 30)}%` }} />
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-[480px] min-h-0 divide-y divide-hair overflow-y-auto" role={onSelect !== undefined ? 'listbox' : 'list'}>
          {items.map((item) => {
            const selected = selectedId === item.id
            const clickable = !item.disabled && (item.onClick !== undefined || onSelect !== undefined)
            const fire = () => {
              if (item.disabled) return
              onSelect?.(item.id)
              item.onClick?.()
            }
            return (
              <div
                key={item.id}
                role={onSelect !== undefined ? 'option' : clickable ? 'button' : undefined}
                aria-selected={onSelect !== undefined ? selected : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={item.title_attr}
                className={cn(
                  'group relative flex items-center justify-between transition-colors duration-fade',
                  SIZE[size],
                  clickable ? 'cursor-pointer hover:bg-hov' : 'cursor-default',
                  selected && 'bg-ctl',
                  item.disabled && 'opacity-50',
                )}
                onClick={fire}
                onKeyDown={(e) => {
                  if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    fire()
                  }
                }}
              >
                {item.accent !== undefined && item.accent !== 'none' && (
                  <span className={cn('absolute top-2 bottom-2 left-0 w-1 rounded-full', ACCENT[item.accent])} aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-2">
                  {item.icon !== undefined && (
                    <span className="grid size-9 flex-none place-items-center rounded-lg bg-ctl/60 text-muted transition-colors duration-fade group-hover:bg-ctl">
                      {item.icon}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn('truncate text-sm font-medium text-muted transition-colors duration-fade group-hover:text-text', selected && 'text-text')}
                    >
                      {item.title}
                    </div>
                    {item.description !== undefined && <div className="mt-0.5 truncate text-xs text-faint">{item.description}</div>}
                  </div>
                </div>
                <div className="ml-3 flex flex-none items-center gap-1">
                  {item.actions !== undefined && (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-fade group-hover:opacity-100 focus-within:opacity-100">
                      {item.actions}
                    </div>
                  )}
                  {item.trailing !== undefined && (
                    <div className="text-dim transition-[color,transform] duration-fade group-hover:translate-x-0.5 group-hover:text-muted">
                      {item.trailing}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
